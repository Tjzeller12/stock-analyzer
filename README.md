Stock Market Analyzer

A full-stack web application for analyzing stocks, tracking portfolios, and staying updated with financial news. Built with React (TypeScript) frontend and Flask (Python) backend.
Features
📊 Portfolio Management

Add and remove stocks from your personal portfolio
View comprehensive stock data including:

Price, EV/EBITDA, P/E Ratio, Market Cap
Dividend Yield, Free Cash Flow, Debt-to-Equity
ROIC, Price-to-Free-Cash-Flow, Cash Equivalents


Sort stocks by various metrics
Real-time portfolio refresh capabilities

📰 News Aggregation

Curated financial news from multiple sources
Filter news by categories:

Blockchain, Earnings, IPO
Mergers & Acquisitions, Financial Markets
Economy (Fiscal, Monetary, Macro)
Sector-specific (Technology, Manufacturing, Energy, etc.)


Time-stamped articles with images and summaries

🤖 AI-Powered Analysis

AlphaBot: AI-driven news summarization using Grok API
Sentiment analysis using FinBERT (Hugging Face)
Stock-specific news summaries and sentiment scores
Toggle between Grok News and Llama 3 analysis

👤 User Features

Secure authentication (registration/login with JWT)
User profiles with customizable settings
Long-term vs Short-term investor preferences
Password reset functionality
Dark/Light theme toggle

📈 Stock Details Page

In-depth financial metrics and analyst ratings
Buy/Hold/Sell rating visualization
News sentiment analysis (Positive/Neutral/Negative)
Interactive stock data display

Tech Stack
Frontend

React 18 with TypeScript
React Router for navigation
Axios for API communication
CSS3 with custom theming system
Responsive design for mobile and desktop

Backend

Flask (Python) REST API
PostgreSQL database
SQLAlchemy ORM
Flask-Migrate for database migrations
Redis for caching and session management
JWT authentication

External APIs

Alpha Vantage - Stock data and news
Financial Modeling Prep - In-depth financial data
Grok (X.AI) - AI news summarization
Hugging Face - Sentiment analysis (FinBERT)

Project Structure
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── constants/     # API endpoints
│   │   ├── utils/         # Utility functions
│   │   ├── resources/     # Images and assets
│   │   └── ThemeContext.tsx
│   └── public/
│
└── server/                # Flask backend
    ├── app/
    │   ├── routes/        # API endpoints
    │   ├── models.py      # Database models
    │   ├── services/      # Business logic
    │   ├── constants.py   # API constants
    │   └── alphaBot.py    # AI integration
    ├── migrations/        # Database migrations
    ├── config.py          # Configuration
    └── run.py            # Application entry point
API Endpoints
Authentication

POST /auth/register - Register new user
POST /auth/login - User login
POST /auth/logout - User logout

Portfolio

POST /portfolio/add - Add stock to portfolio
POST /portfolio/remove - Remove stock from portfolio
POST /portfolio/refresh - Refresh portfolio data
POST /portfolio/stocks - Get sorted stocks

Stock Data

POST /data/stock_data - Get stock details
POST /data/news - Get filtered news
POST /data/in_depth_data - Get in-depth financials

Profile

POST /profile/info - Get user info
POST /profile/save - Update profile
POST /profile/reset - Reset password

AlphaBot

POST /alphaBot/news_summary - Generate AI news summary
POST /alphaBot/article_sentiment - Analyze sentiment

Database Schema
Main Tables

User - User accounts and preferences
Portfolio - User portfolios (one-to-one with User)
StockMaster - Master stock data (shared across users)
Stock - Portfolio-stock relationships
StockNews - Stock-specific news and sentiment
GeneralStockNews - Filtered news articles
Filter - News filter categories

Features in Detail
Caching Strategy

Redis caching with 15-minute timeout for stock prices
1-hour timeout for stock data and news
Automatic cache invalidation on data updates

Theme System

CSS custom properties for dynamic theming
User preference stored in localStorage
Seamless dark/light mode switching

Security

JWT token-based authentication
Password hashing with bcrypt
CORS protection
Secure session management

Contributing

Fork the repository
Create a feature branch
Commit your changes
Push to the branch
Open a Pull Request

Acknowledgments

Alpha Vantage for stock market data
Financial Modeling Prep for financial metrics
Hugging Face for sentiment analysis models
X.AI for Grok API access


Note: Remember to obtain and configure your own API keys for all external services before running the application.
