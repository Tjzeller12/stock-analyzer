// Base URL for the backend API (overridable via environment)
export const API_BASE_URL: string = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) 
    ? String(import.meta.env.VITE_API_BASE_URL) 
    : 'http://localhost:5001';
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
    CHART: `${API_BASE_URL}/data/chart_data`,
} as const;

// AlphaBot endpoints
export const ALPHA_BOT_ENDPOINTS = {
    BASE: `${API_BASE_URL}/alphaBot`,
    COMPARE: `${API_BASE_URL}/alphaBot/compare_analysis`,
    USER_QUERY: `${API_BASE_URL}/alphaBot/user_query`,
    IN_DEPTH: `${API_BASE_URL}/alphaBot/in_depth_analysis`,
    EVENT_PULSE: `${API_BASE_URL}/alphaBot/event_pulse`,
} as const;

// Profile endpoints
export const PROFILE_ENDPOINTS = {
    RESET_PASSWORD: `${API_BASE_URL}/profile/reset`,
    SAVE: `${API_BASE_URL}/profile/save`,
    INFO: `${API_BASE_URL}/profile/info`,
    INVESTOR: `${API_BASE_URL}/profile/investor`,
} as const;

// Radar endpoints
export const RADAR_ENDPOINTS = {
    SINGLE: `${API_BASE_URL}/radar/single`,
    COMPARE: `${API_BASE_URL}/radar/compare`,
} as const;

// Brokerage import endpoints
export const BROKERAGE_ENDPOINTS = {
    CONNECT_START: `${API_BASE_URL}/brokerage/connect/start`,
    CONNECT_CALLBACK: `${API_BASE_URL}/brokerage/connect/callback`,
    SYNC: `${API_BASE_URL}/brokerage/sync`,
    HOLDINGS: `${API_BASE_URL}/brokerage/holdings`,
    DISCONNECT: `${API_BASE_URL}/brokerage/disconnect`,
    PUBLISH: `${API_BASE_URL}/brokerage/publish`,
} as const;

