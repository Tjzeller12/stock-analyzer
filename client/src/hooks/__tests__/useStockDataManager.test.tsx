import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStockDataManager } from '../useStockDataManager';
import { authPost } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn(),
}));

describe('useStockDataManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs successfully with a null symbol safely', () => {
    const { result } = renderHook(() => useStockDataManager(undefined, null));
    expect(result.current.stock).toBeNull();
    expect(result.current.radarScores).toBeNull();
  });

  it('processes fetched data and properly calculates article sentiment scoring logic percentages explicitly', async () => {
    (authPost as any).mockImplementation((url: string) => {
      return Promise.resolve({ 
        symbol: 'AAPL', 
        news_sentiment_data: { feed: [
          { overall_sentiment_label: 'Bullish' },
          { overall_sentiment_label: 'Bearish' },
          { overall_sentiment_label: 'Neutral' },
          { overall_sentiment_label: 'Bullish' },
        ]} 
      });
    });

    const { result } = renderHook(() => useStockDataManager('AAPL', null));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.totalArticles).toBe(4);
    expect(result.current.positiveScore).toBe(50); // 2/4 = 50%
    expect(result.current.negativeScore).toBe(25); // 1/4 = 25%
    expect(result.current.neutralScore).toBe(25);  // 1/4 = 25%
  });
});
