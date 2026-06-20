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

// ------------------------------------------------------------------ //
// Streaming support                                                    //
// ------------------------------------------------------------------ //

/** Parsed payload from a single SSE ``data:`` line. */
export interface StreamEventPayload {
    type: 'chunk' | 'tool_running' | 'done' | 'error';
    text?: string;
    count?: number;
    message?: string;
}

/**
 * POST to an SSE streaming endpoint and invoke ``onEvent`` for each parsed
 * event as it arrives.  Uses the native ``fetch`` API (not axios) so the
 * response body can be consumed as a ``ReadableStream``.
 *
 * Throws on HTTP errors (non-2xx) so callers can catch normally.
 */
export const authStreamPost = async (
    url: string,
    payload: unknown,
    onEvent: (event: StreamEventPayload) => void,
): Promise<void> => {
    const token = localStorage.getItem('token');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (possibly incomplete) segment in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6)) as StreamEventPayload;
                    onEvent(data);
                } catch {
                    // Ignore malformed SSE lines
                }
            }
        }
    }
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
