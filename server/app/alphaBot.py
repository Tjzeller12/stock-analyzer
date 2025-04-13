from flask import Blueprint, request, jsonify
# Use a pipeline as a high-level helper
from openai import OpenAI
import requests
import statistics
import os


# Make alphaBot blueprint
alphaBot_bp = Blueprint('alphaBot', __name__)

# Replace the hardcoded token with an environment variable
GROK_KEY = os.getenv('GROK_KEY')
ALPHA_VANTAGE_KEY = os.getenv('ALPHA_VANTAGE_KEY')
HUGGING_FACE_TOKEN = os.getenv('HUGGING_FACE_TOKEN')

client = OpenAI(
    api_key=GROK_KEY,
    base_url="https://api.x.ai/v1"
)


@alphaBot_bp.route('/alphaBot', methods=['POST'])
def alphaBot_endpoint():
    return jsonify({"message": "AlphaBot is running"}), 200

@alphaBot_bp.route('/alphaBot/article_sentiment', methods=['POST'])
def get_article_sentiment(summary):
    finbert_response = requests.post(
        "https://api-inference.huggingface.co/models/ProsusAI/finbert",
        headers={"Authorization": f"Bearer {HUGGING_FACE_TOKEN}"},
        json={"inputs": summary}
    )
    return finbert_response.json()

@alphaBot_bp.route('/alphaBot/news_summary', methods=['POST'])
def get_news_summary(news_list, stock_symbol, article_sentiment):
    # Join the news list into a single string
    news_string = " ".join([news.get("title", "") for news in news_list])
    # Create the prompt
    prompt = f"Summarize {stock_symbol}'s news and state given the following news: {news_string} and overall sentiment: {article_sentiment}"
    # Make the request to the Groq API
    url = "https://api.groq.com/openai/v1/chat/completions"
    # Make the request to the Groq API
    payload = {
        "prompt": prompt,
        "max_tokens": 100,
        "model": "grok-beta"
    }

    headers = {
        "Authorization": f"Bearer {GROK_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json=payload)
    return response.json().get("text", "Summary not found")

def get_news_list(stock_symbol):
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={stock_symbol}&apikey={ALPHA_VANTAGE_KEY}"
    response = requests.get(url)
    return response.json()