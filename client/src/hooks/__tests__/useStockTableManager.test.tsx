import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useStockTableManager } from '../useStockTableManager';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue([{ symbol: 'AAPL' }])
}));

describe('useStockTableManager', () => {
  it('instantiates cleanly and maps table manipulation functions to public space correctly', async () => {
    const { result } = renderHook(() => useStockTableManager('symbol'));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The hook natively exposes manipulation functions safely
    expect(typeof result.current.fetchStocks).toBe('function');
    expect(result.current.loading).toBeDefined();
  });
});
