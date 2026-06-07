"""
test_news.py — unit and integration tests for the news feature.

Covers:
  - POST /data/news route (auth guard, filter validation, cache, API fetch)
  - process_news_data() (long URLs/summaries stored in full, link field populated,
    filtered titles, correct field mapping)
  - GeneralStockNews.to_dict() (link field present and correct)
"""
import datetime
import json
import pytest
from unittest.mock import patch

from app import db
from app.models import GeneralStockNews, Filter
from app.services.news_manager import process_news_data


# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #

LONG_URL = "https://example.com/" + "a" * 300          # 310 chars — exceeds old VARCHAR(255)
LONG_SUMMARY = "Summary text. " * 30                    # 420 chars — exceeds old VARCHAR(255)
LONG_IMAGE = "https://cdn.example.com/" + "b" * 300     # 324 chars


def make_av_feed(num_articles=3, long_fields=False):
    """Build a minimal Alpha Vantage news feed response."""
    feed = []
    for i in range(num_articles):
        feed.append({
            "title":                  f"Article {i}: Market moves significantly",
            "url":                    LONG_URL if long_fields else f"https://example.com/article-{i}",
            "time_published":         f"20240115T{str(i).zfill(2)}0000",
            "summary":                LONG_SUMMARY if long_fields else f"Short summary {i}.",
            "banner_image":           LONG_IMAGE if long_fields else f"https://example.com/img-{i}.jpg",
            "source":                 "TestSource",
            "overall_sentiment_score": 0.25,
            "overall_sentiment_label": "Bullish",
            "ticker_sentiment":       [],
        })
    return {"feed": feed, "items": str(num_articles)}


# ------------------------------------------------------------------ #
# Route tests: POST /data/news                                         #
# ------------------------------------------------------------------ #

class TestNewsRoute:

    def test_requires_auth(self, client):
        resp = client.post("/data/news", json={"filter": "all"})
        assert resp.status_code == 401

    def test_unknown_filter_returns_404(self, client, auth_headers):
        resp = client.post(
            "/data/news",
            json={"filter": "totally_fake_filter_xyz"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_missing_filter_returns_404(self, client, auth_headers):
        resp = client.post("/data/news", json={}, headers=auth_headers)
        assert resp.status_code == 404

    def test_fetches_from_api_when_cache_stale(self, client, auth_headers, app):
        """When no recent news exists in DB, the route fetches from Alpha Vantage."""
        with app.app_context():
            f = Filter.query.filter_by(filter_name="all").first()
            if not f:
                f = Filter(filter_name="all")
                db.session.add(f)
                db.session.commit()
            # Clear any cached articles so this test starts stale
            GeneralStockNews.query.filter_by(filter_id=f.id).delete()
            db.session.commit()

        av_feed = make_av_feed(3)
        with patch("app.routes.stock_data.get_news_data", return_value=av_feed):
            resp = client.post(
                "/data/news",
                json={"filter": "all"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) == 3
        assert data[0]["title"] == "Article 0: Market moves significantly"

        # Cleanup so subsequent tests start with a clean slate
        with app.app_context():
            f2 = Filter.query.filter_by(filter_name="all").first()
            if f2:
                GeneralStockNews.query.filter_by(filter_id=f2.id).delete()
                db.session.commit()

    def test_returns_cached_news_when_fresh(self, client, auth_headers, app):
        """If news was inserted less than 15 minutes ago, DB cache is returned."""
        with app.app_context():
            # Seed the all filter and a fresh news row
            f = Filter.query.filter_by(filter_name="all").first()
            if not f:
                f = Filter(filter_name="all")
                db.session.add(f)
                db.session.commit()
            row = GeneralStockNews(
                filter_id=f.id,
                title="Cached Article",
                summary="Cached summary.",
                link="https://example.com/cached",
                image_link="https://example.com/img.jpg",
                news_company="CacheSource",
                time_published=datetime.datetime.now(),
                last_news_update=datetime.datetime.now(),
            )
            db.session.add(row)
            db.session.commit()
            row_id = row.id

        # Should NOT call the API — we expect a 200 from DB cache
        with patch("app.routes.stock_data.get_news_data") as mock_av:
            resp = client.post(
                "/data/news",
                json={"filter": "all"},
                headers=auth_headers,
            )
        mock_av.assert_not_called()
        assert resp.status_code == 200

        # Cleanup
        with app.app_context():
            r = GeneralStockNews.query.get(row_id)
            if r:
                db.session.delete(r)
                db.session.commit()

    def test_no_feed_from_api_returns_404(self, client, auth_headers, app):
        """If Alpha Vantage returns no feed, the route returns 404."""
        with app.app_context():
            f = Filter.query.filter_by(filter_name="all").first()
            if not f:
                f = Filter(filter_name="all")
                db.session.add(f)
                db.session.commit()
            # Ensure no fresh cached news so the route actually calls the API
            GeneralStockNews.query.filter_by(filter_id=f.id).delete()
            db.session.commit()

        with patch("app.routes.stock_data.get_news_data", return_value={}):
            resp = client.post(
                "/data/news",
                json={"filter": "all"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


# ------------------------------------------------------------------ #
# Unit tests: process_news_data()                                      #
# ------------------------------------------------------------------ #

class TestProcessNewsData:

    def _get_filter_id(self, app):
        with app.app_context():
            f = Filter.query.filter_by(filter_name="all").first()
            if not f:
                f = Filter(filter_name="all")
                db.session.add(f)
                db.session.commit()
            return f.id

    def test_stores_articles_in_db(self, app):
        filter_id = self._get_filter_id(app)

        with app.app_context():
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

            feed = make_av_feed(5)
            process_news_data(feed, filter_id)

            rows = GeneralStockNews.query.filter_by(filter_id=filter_id).all()
            assert len(rows) == 5

            # Cleanup
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

    def test_link_field_is_populated(self, app):
        """The link (URL) field must be stored so articles are clickable."""
        filter_id = self._get_filter_id(app)

        with app.app_context():
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

            feed = make_av_feed(1)
            process_news_data(feed, filter_id)

            row = GeneralStockNews.query.filter_by(filter_id=filter_id).first()
            assert row is not None
            assert row.link == "https://example.com/article-0"
            assert row.link.startswith("https://")

            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

    def test_long_url_stored_without_truncation(self, app):
        """URLs longer than 255 chars must be stored in full (Text column)."""
        filter_id = self._get_filter_id(app)

        with app.app_context():
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

            feed = make_av_feed(1, long_fields=True)
            process_news_data(feed, filter_id)

            row = GeneralStockNews.query.filter_by(filter_id=filter_id).first()
            assert row is not None
            assert len(row.link) > 255, "URL was truncated — column is still VARCHAR(255)"
            assert row.link == LONG_URL

            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

    def test_long_summary_stored_without_truncation(self, app):
        """Summaries longer than 255 chars must be stored in full (Text column)."""
        filter_id = self._get_filter_id(app)

        with app.app_context():
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

            feed = make_av_feed(1, long_fields=True)
            process_news_data(feed, filter_id)

            row = GeneralStockNews.query.filter_by(filter_id=filter_id).first()
            assert row is not None
            assert len(row.summary) > 255, "Summary was truncated — column is still VARCHAR(255)"
            assert row.summary == LONG_SUMMARY

            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

    def test_before_you_continue_articles_skipped(self, app):
        """Articles titled 'Before you continue' (cookie banners) must be filtered."""
        filter_id = self._get_filter_id(app)

        with app.app_context():
            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()

            feed = {
                "feed": [
                    {"title": "Before you continue", "url": "https://example.com/1",
                     "time_published": "20240115T000000", "summary": "...",
                     "banner_image": "", "source": "Google"},
                    {"title": "Real Article", "url": "https://example.com/2",
                     "time_published": "20240115T010000", "summary": "Real content.",
                     "banner_image": "", "source": "Bloomberg"},
                ]
            }
            process_news_data(feed, filter_id)

            rows = GeneralStockNews.query.filter_by(filter_id=filter_id).all()
            titles = [r.title for r in rows]
            assert "Before you continue" not in titles
            assert "Real Article" in titles

            GeneralStockNews.query.filter_by(filter_id=filter_id).delete()
            db.session.commit()


# ------------------------------------------------------------------ #
# Unit tests: GeneralStockNews.to_dict()                               #
# ------------------------------------------------------------------ #

class TestGeneralStockNewsToDict:

    def test_to_dict_includes_link(self, app):
        """to_dict() must include the link field so the frontend can open articles."""
        with app.app_context():
            row = GeneralStockNews(
                title="Test Article",
                summary="Test summary.",
                link="https://example.com/article",
                image_link="https://example.com/img.jpg",
                news_company="TestSource",
                time_published=datetime.datetime.now(),
                last_news_update=datetime.datetime.now(),
            )
            d = row.to_dict()
            assert "link" in d
            assert d["link"] == "https://example.com/article"

    def test_to_dict_includes_all_display_fields(self, app):
        """to_dict() must contain every field the frontend NewsListItem renders."""
        with app.app_context():
            row = GeneralStockNews(
                title="Title",
                summary="Summary.",
                link="https://example.com",
                image_link="https://example.com/img.jpg",
                news_company="Source",
                time_published=datetime.datetime(2024, 1, 15, 12, 0, 0),
                last_news_update=datetime.datetime.now(),
            )
            d = row.to_dict()
            for field in ("title", "summary", "link", "image_link", "news_company", "time_published"):
                assert field in d, f"Missing field in to_dict(): {field}"
