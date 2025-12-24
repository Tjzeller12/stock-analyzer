// Base URL for the backend API (overridable via environment)
declare const process: any;
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://3.85.3.252:5001';

// Auth endpoints
export const AUTH_ENDPOINTS = {
    LOGIN: `${API_BASE_URL}/auth/login`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    REGISTER: `${API_BASE_URL}/auth/register`,
} as const;

// Portfolio endpoints
export const PORTFOLIO_ENDPOINTS = {
    ADD: `${API_BASE_URL}/portfolio/add`,
    REMOVE: `${API_BASE_URL}/portfolio/remove`,
    REFRESH: `${API_BASE_URL}/portfolio/refresh`,
    UPDATE: `${API_BASE_URL}/portfolio/update`,
    STOCKS: `${API_BASE_URL}/portfolio/stocks`,
} as const;

// Data endpoints
export const DATA_ENDPOINTS = {
    STOCK: `${API_BASE_URL}/data/stock_data`,
    NEWS: `${API_BASE_URL}/data/news`,
    IN_DEPTH: `${API_BASE_URL}/data/in_depth_data`,
} as const;

// AlphaBot endpoints
export const ALPHA_BOT_ENDPOINTS = {
    BASE: `${API_BASE_URL}/alphaBot`,
    SENTIMENT: `${API_BASE_URL}/alphaBot/article_sentiment`,
    NEWS_SUMMARY: `${API_BASE_URL}/alphaBot/news_summary`,
} as const;

// Profile endpoints
export const PROFILE_ENDPOINTS = {
    RESET_PASSWORD: `${API_BASE_URL}/profile/reset`,
    SAVE: `${API_BASE_URL}/profile/save`,
    INFO: `${API_BASE_URL}/profile/info`,
} as const;

// Analysis endpoints
export const ANALYSIS_ENDPOINTS = {
    COMPARE: `${API_BASE_URL}/analysis/compare`,
} as const;
