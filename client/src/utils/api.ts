import axios, { AxiosRequestConfig } from 'axios';

/**
 * Get authentication headers for API requests
 */
export const getAuthHeaders = (): { Authorization: string } => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
};

/**
 * Create axios request config with auth headers
 */
export const createAuthConfig = (config: AxiosRequestConfig = {}): AxiosRequestConfig => {
    return {
        ...config,
        headers: {
            ...config.headers,
            ...getAuthHeaders(),
        },
    };
};

/**
 * Make an authenticated POST request
 */
export const authPost = async <T>(url: string, data?: any): Promise<T> => {
    const response = await axios.post(url, data, createAuthConfig());
    return response.data;
};

/**
 * Make an authenticated GET request
 */
export const authGet = async <T>(url: string): Promise<T> => {
    const response = await axios.get(url, createAuthConfig());
    return response.data;
};
