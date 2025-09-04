from flask import Blueprint, request, jsonify, current_app
from app import cache
from openai import OpenAI
import requests
import os
from app.constants import GROK_BASE_URL, HUGGING_FACE_API_URL
from app.utils.api import build_alpha_vantage_url, build_hugging_face_headers
from app.constants import AlphaVantageFunction

# Make alphaBot blueprint
alphaBot_bp = Blueprint('alphaBot', __name__)

# Get API keys from environment
GROK_KEY = os.getenv('GROK_KEY')

client = OpenAI(
    api_key=GROK_KEY,
    base_url=GROK_BASE_URL
)


@alphaBot_bp.route('/alphaBot', methods=['POST'])
def alphaBot_endpoint():
    return jsonify({"message": "AlphaBot is running"}), 200

@cache.memoize(timeout=3600)
@alphaBot_bp.route('/alphaBot/article_sentiment', methods=['POST'])
def get_article_sentiment(summary):
    finbert_response = requests.post(
        HUGGING_FACE_API_URL,
        headers=build_hugging_face_headers(),
        json={"inputs": summary}
    )
    return finbert_response.json()

@alphaBot_bp.route('/alphaBot/news_summary', methods=['POST'])
def get_news_summary():
    data = request.json
    stock_symbol = data.get("stock_symbol")
    if not stock_symbol:
        return jsonify({"error": "Stock symbol is required"}), 400
    
    news_list = get_news_list(stock_symbol)
    if not news_list:
        return jsonify({"error": "Failed to fetch news list"}), 500
    
    articles = news_list['feed'][:10]
    
    formated_articles = [
        f"Article {i+1}: {article.get('title', '')} - {article.get('summary', '')}"
        for i, article in enumerate(articles)
    ]

    news_string = "\n".join(formated_articles)

    prompt = (
        f"Here are up to 10 news articles for {stock_symbol}:\n"
        f"{news_string}\n"
        f"Please analyze the sentiment of each article and provide a summary of the overall sentiment for {stock_symbol}. "
        "Try to be cautious with sensationalism and try to be objective. Provide just the summary, no other text. "
        "Summarize key points and most significant details of the events/trends."
    )

    try:
        response = client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes news articles."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
        )
        summary = response.choices[0].message.content.strip()
        return jsonify({"summary": summary}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating news summary: {e}")
        return jsonify({"error": "Failed to generate news summary"}), 500
        
@cache.memoize(timeout=3600)
def get_news_list(stock_symbol):
    url = build_alpha_vantage_url(AlphaVantageFunction.NEWS_SENTIMENT, tickers=stock_symbol)
    response = requests.get(url)
    return response.json()