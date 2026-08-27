/**
 * useAlphaBotStream
 * -----------------
 * Generic, reusable hook for consuming AlphaBot SSE streaming endpoints.
 *
 * Encapsulates all SSE parsing, state transitions, and error handling so
 * that feature-level hooks (useEventPulseManager, useStockAnalysisManager,
 * etc.) only need to call ``start(url, payload)`` and read the returned state.
 *
 * State shape
 * -----------
 * streamingText  — Accumulated text from all ``chunk`` events so far.
 * isLoading      — True from the moment ``start`` is called until ``done``
 *                  or ``error`` is received.
 * isStreaming     — True once the first ``chunk`` event arrives, meaning
 *                  the final generation turn has begun.
 * toolsRunning   — Number of parallel tool calls currently in-flight
 *                  (0 when idle or in the final generation turn).
 * error          — Non-null when a terminal ``error`` event is received.
 */
import { useState, useCallback, useRef } from 'react';
import { authStreamPost } from '../utils/api';

export interface AlphaBotStreamState {
    streamingText: string;
    isLoading: boolean;
    isStreaming: boolean;
    toolsRunning: number;
    /** Human-readable description of what tools are currently being fetched. */
    toolMessage: string;
    error: string | null;
}

export interface UseAlphaBotStreamReturn extends AlphaBotStreamState {
    /** Start a streaming request. Resets all state before fetching. */
    start: (url: string, payload: unknown) => Promise<void>;
    /** Reset all state back to the initial idle values. */
    reset: () => void;
    /**
     * Returns the full accumulated text synchronously.
     * Useful inside ``onDone`` callbacks where stale closure state might
     * return an empty string from ``streamingText``.
     */
    getFullText: () => string;
}

const INITIAL: AlphaBotStreamState = {
    streamingText: '',
    isLoading: false,
    isStreaming: false,
    toolsRunning: 0,
    toolMessage: '',
    error: null,
};

/**
 * @param onDone  Optional callback invoked with the complete accumulated text
 *                once the ``done`` event is received.  Useful for callers
 *                that need to post-process the final result (e.g. JSON parsing
 *                in compare analysis).
 */
export const useAlphaBotStream = (
    onDone?: (fullText: string) => void,
): UseAlphaBotStreamReturn => {
    const [state, setState] = useState<AlphaBotStreamState>(INITIAL);
    // Ref avoids stale-closure issues when reading the full text in onDone
    const fullTextRef = useRef('');

    const reset = useCallback(() => {
        fullTextRef.current = '';
        setState(INITIAL);
    }, []);

    const start = useCallback(
        async (url: string, payload: unknown): Promise<void> => {
            fullTextRef.current = '';
            setState({ ...INITIAL, isLoading: true });

            try {
                await authStreamPost(url, payload, (event) => {
                    switch (event.type) {
                        case 'chunk':
                            fullTextRef.current += event.text ?? '';
                            setState((prev) => ({
                                ...prev,
                                isStreaming: true,
                                toolsRunning: 0,
                                streamingText: prev.streamingText + (event.text ?? ''),
                            }));
                            break;

                        case 'tool_running':
                            setState((prev) => ({
                                ...prev,
                                toolsRunning: event.count ?? 0,
                                toolMessage: event.message ?? '',
                            }));
                            break;

                        case 'done':
                            setState((prev) => ({
                                ...prev,
                                isLoading: false,
                                isStreaming: false,
                                toolsRunning: 0,
                                toolMessage: '',
                            }));
                            onDone?.(fullTextRef.current);
                            break;

                        case 'error':
                            setState((prev) => ({
                                ...prev,
                                isLoading: false,
                                isStreaming: false,
                                toolsRunning: 0,
                                error: event.message ?? 'Unknown error.',
                            }));
                            break;
                    }
                });
            } catch (err) {
                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    isStreaming: false,
                    error: err instanceof Error ? err.message : 'Request failed.',
                }));
            }
        },
        [onDone],
    );

    return { ...state, start, reset, getFullText: () => fullTextRef.current };
};
