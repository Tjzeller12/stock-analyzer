import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStockAnalysisManager } from '../useStockAnalysisManager';
import { authPost } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn(),
}));

describe('useStockAnalysisManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches in-depth analysis on mount if symbol is provided', async () => {
    (authPost as any).mockResolvedValueOnce({ response: 'Test summary analysis output.' });
    
    const { result } = renderHook(() => useStockAnalysisManager('AAPL'));
    
    // Simulate event loop tick for async mount
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(authPost).toHaveBeenCalledWith('http://localhost:5001/alphaBot/in_depth_analysis', { stock_symbol: 'AAPL' });
    expect(result.current.summary).toBe('Test summary analysis output.');
  });

  it('sends chat and dynamically appends the AI bot response directly into the current chat state', async () => {
    (authPost as any).mockResolvedValue({ response: 'I am an AI bot response.' });
    
    const { result } = renderHook(() => useStockAnalysisManager('AAPL'));
    
    // Fire off the API method
    await act(async () => {
      await result.current.sendChat('What is the P/E ratio?');
    });
    
    expect(result.current.chatMessages).toHaveLength(2);
    expect(result.current.chatMessages[0]).toEqual({ role: 'user', content: 'What is the P/E ratio?' });
    expect(result.current.chatMessages[1]).toEqual({ role: 'assistant', content: 'I am an AI bot response.' });
    expect(authPost).toHaveBeenCalledWith('http://localhost:5001/alphaBot/user_query', { stock_symbol: 'AAPL', user_query: 'What is the P/E ratio?' });
  });

  it('gracefully handles missing symbols and whitespace trims', async () => {
    const { result } = renderHook(() => useStockAnalysisManager(''));
    
    await act(async () => {
      await result.current.sendChat('    ');
    });
    
    expect(result.current.chatMessages).toHaveLength(0); // Should be completely blocked
    expect(authPost).not.toHaveBeenCalled();
  });
});
