import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNewsListManager } from '../useNewsListManager';
import { authPost } from '../../utils/api';
import { DATA_ENDPOINTS } from '../../constants/api';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn(),
}));

describe('useNewsListManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes cleanly', () => {
    const { result } = renderHook(() => useNewsListManager());
    expect(result.current.newsFilter).toBe('all');
    expect(result.current.articles).toEqual([]);
  });

  it('safely extracts articles when wrapped irregularly in a feed object matrix response', async () => {
    (authPost as any).mockResolvedValueOnce({ feed: [{ title: 'News!' }] });
    
    const { result } = renderHook(() => useNewsListManager());
    
    await act(async () => {
      await result.current.handleFilterChange('tech');
    });
    
    expect(authPost).toHaveBeenCalledWith(DATA_ENDPOINTS.NEWS, { filter: 'tech' });
    expect(result.current.newsFilter).toBe('tech');
    expect(result.current.articles).toEqual([{ title: 'News!' }]);
  });
});
