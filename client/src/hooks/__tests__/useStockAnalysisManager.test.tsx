import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStockAnalysisManager } from '../useStockAnalysisManager';
import { ALPHA_BOT_ENDPOINTS } from '../../constants/api';

const mockStart = vi.fn();
const mockReset = vi.fn();

vi.mock('../useAlphaBotStream', () => ({
  useAlphaBotStream: vi.fn(() => ({
    streamingText: '',
    isLoading: false,
    isStreaming: false,
    toolsRunning: 0,
    toolMessage: '',
    error: null,
    start: mockStart,
    reset: mockReset,
    getFullText: vi.fn(() => ''),
  })),
}));

describe('useStockAnalysisManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts streaming in-depth analysis on mount when symbol is provided', async () => {
    renderHook(() => useStockAnalysisManager('AAPL'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockStart).toHaveBeenCalledWith(
      ALPHA_BOT_ENDPOINTS.IN_DEPTH_STREAM,
      { stock_symbol: 'AAPL' },
    );
  });

  it('appends user message and a streaming assistant placeholder when chat is sent', async () => {
    const { result } = renderHook(() => useStockAnalysisManager('AAPL'));

    await act(async () => {
      await result.current.sendChat('What is the P/E ratio?');
    });

    expect(result.current.chatMessages).toHaveLength(2);
    expect(result.current.chatMessages[0]).toEqual({ role: 'user', content: 'What is the P/E ratio?' });
    expect(result.current.chatMessages[1]).toMatchObject({ role: 'assistant', isStreaming: true });
    expect(mockStart).toHaveBeenCalledWith(
      ALPHA_BOT_ENDPOINTS.USER_QUERY_STREAM,
      { stock_symbol: 'AAPL', user_query: 'What is the P/E ratio?' },
    );
  });

  it('gracefully handles missing symbols and whitespace trims', async () => {
    const { result } = renderHook(() => useStockAnalysisManager(''));

    await act(async () => {
      await result.current.sendChat('    ');
    });

    expect(result.current.chatMessages).toHaveLength(0);
    // start should only have been called for the summary (symbol is empty, so not even that)
    const chatStartCalls = mockStart.mock.calls.filter(
      ([url]) => url === ALPHA_BOT_ENDPOINTS.USER_QUERY_STREAM,
    );
    expect(chatStartCalls).toHaveLength(0);
  });
});
