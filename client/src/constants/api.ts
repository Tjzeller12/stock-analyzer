// Base URL for the backend API (overridable via environment)
export const API_BASE_URL: string = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) 
    ? String(import.meta.env.VITE_API_BASE_URL) 
    : 'http://localhost:5001';
// Auth endpoints
export const AUTH_ENDPOINTS = {
    LOGIN: `${API_BASE_URL}/auth/login`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    GOOGLE: `${API_BASE_URL}/auth/google`,
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
    SEARCH: `${API_BASE_URL}/data/search`,
} as const;

// AlphaBot endpoints
export const ALPHA_BOT_ENDPOINTS = {
    BASE: `${API_BASE_URL}/alphaBot`,
    USAGE: `${API_BASE_URL}/alphaBot/usage`,
    COMPARE: `${API_BASE_URL}/alphaBot/compare_analysis`,
    USER_QUERY: `${API_BASE_URL}/alphaBot/user_query`,
    IN_DEPTH: `${API_BASE_URL}/alphaBot/in_depth_analysis`,
    EVENT_PULSE: `${API_BASE_URL}/alphaBot/event_pulse`,
    // Streaming SSE variants
    COMPARE_STREAM: `${API_BASE_URL}/alphaBot/compare_analysis/stream`,
    USER_QUERY_STREAM: `${API_BASE_URL}/alphaBot/user_query/stream`,
    IN_DEPTH_STREAM: `${API_BASE_URL}/alphaBot/in_depth_analysis/stream`,
    EVENT_PULSE_STREAM: `${API_BASE_URL}/alphaBot/event_pulse/stream`,
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

// Discovery endpoints
export const DISCOVERY_ENDPOINTS = {
    GENERATE: `${API_BASE_URL}/discovery/generate`,
} as const;

