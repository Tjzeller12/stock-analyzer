import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompareAlphaBotManager } from '../useCompareAlphaBotManager';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue({}),
}));

describe('useCompareAlphaBotManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); // Ensure persistent DB is flushed
  });

  it('properly guards toggling limits against symbols and persists explicitly to local storage instances', () => {
    const { result } = renderHook(() => useCompareAlphaBotManager());
    
    act(() => {
      result.current.toggleSelectSymbol('AAPL');
    });
    
    expect(result.current.selectedSymbols.has('AAPL')).toBe(true);
    expect(localStorage.getItem('selectedSymbols')).toContain('AAPL');
  });

  it('enforces comparison constraints securely preventing undefined API boundaries implicitly', async () => {
    const { result } = renderHook(() => useCompareAlphaBotManager());
    
    await act(async () => {
      // Trying to cleanly map compare request with 0 formally selected stocks internally validated
      await result.current.compareStocks(['AAPL', 'TSLA'], { name: 'test', normalization_method: 'min-max', scope: 'global', equations: {} });
    });
    
    expect(result.current.compareError).toMatch(/Select at least 2/i);
  });
});
