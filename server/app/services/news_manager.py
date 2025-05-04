import datetime
from flask import jsonify
from app import db
from app.models import GeneralStockNews, Filter

def get_filter_id(filter):
    filter_object = Filter.query.filter(db.func.lower(Filter.filter_name) == filter.lower()).first()
    if not filter_object:
        return jsonify({"error": "Filter not found"}), 404
    
    return filter_object.id
    
def process_news_data(data, filter_id):
     # Process the news data
        processed_news = []
        for article in data['feed']:
            title = article.get('title', '')
            if title == 'Before you continue':
                continue
            
            # Use f-string for safe printing
            processed_news.append({
                "image_link": article.get('banner_image', ''),
                "link": article.get('url', ''),
                "title": title,
                "news_company": article.get('source', ''),
                "time_published": article.get('time_published', ''),
                "summary": article.get('summary', '')
            })
            stock_news = GeneralStockNews(
                filter_id=filter_id,
                title=title,
                summary=article.get('summary', ''),
                link=article.get('url', ''),
                time_published=article.get('time_published', ''),   
                news_company=article.get('source', ''),
                image_link=article.get('banner_image', ''),
                bias_rating=None,
                last_news_update=datetime.datetime.now()
            )
            db.session.add(stock_news)
            db.session.commit()
            db.session.expire_all()
        return processed_news

def seed_filters():
    filters = [
        'all',
        'blockchain',
        'earnings',
        'ipo',
        'mergers_and_acquisitions',
        'financial_markets',
        'economy_fiscal',
        'economy_monetary',
        'economy_macro',
        'energy_transportation',
        'finance',
        'life_sciences',
        'manufacturing',
        'real_estate',
        'retail_wholesale',
        'technology'
    ]
    for i, filter in enumerate(filters, start=1):
        if not Filter.query.filter_by(filter_name=filter).first():
            db.session.add(Filter(id=i, filter_name=filter))
    
    db.session.commit()
    db.session.expire_all()
    