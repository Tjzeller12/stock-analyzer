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
export const authPost = async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await axios.post<T>(url, data, createAuthConfig());
    return response.data;
};

/**
 * Make an authenticated GET request
 */
export const authGet = async <T>(url: string): Promise<T> => {
    const response = await axios.get<T>(url, createAuthConfig());
    return response.data;
};

/**
 * Make an authenticated PUT request
 */
export const authPut = async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await axios.put<T>(url, data, createAuthConfig());
    return response.data;
};

// Add a response interceptor to handle 401 Unauthorized errors globally
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      // If 401 Unauthorized, clear token and redirect to login
      console.log("Session expired or unauthorized. Redirecting to login...");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
);
