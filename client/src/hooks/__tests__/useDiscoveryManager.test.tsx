import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCOVERY_ENDPOINTS, PORTFOLIO_ENDPOINTS } from '../../constants/api';
import { authPost } from '../../utils/api';
import { MAX_REFINEMENTS, useDiscoveryManager } from '../useDiscoveryManager';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const okResponse = (tickers: string[], hasProfile = true) => ({
  recommendations: tickers.map((t) => ({
    ticker: t,
    company_name: `${t} Inc`,
    rationale: 'Reason.',
    sector: 'Technology',
  })),
  generated_from: { has_profile: hasProfile, refinement_count: 0 },
});
const post = vi.mocked(authPost);

describe('useDiscoveryManager', () => {
  beforeEach(() => {
    post.mockReset();
    mockNavigate.mockClear();
  });

  it('searches with an empty draft', async () => {
    post.mockResolvedValueOnce(okResponse(['MSFT', 'AAPL']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.generate('   ');
    });

    expect(authPost).toHaveBeenCalledWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: [] });
    expect(result.current.recommendations).toHaveLength(2);
    expect(result.current.hasProfile).toBe(true);
    expect(result.current.hasGenerated).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('includes pending text after the staged filters', async () => {
    post.mockResolvedValueOnce(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    act(() => {
      result.current.addRefinement('  Exclude EV companies  ');
      result.current.addRefinement('   ');
      result.current.addRefinement('Prefer dividends');
    });
    expect(authPost).not.toHaveBeenCalled();
    expect(result.current.refinements).toEqual(['Exclude EV companies', 'Prefer dividends']);
    await act(async () => {
      await result.current.generate('  Include utilities  ');
    });
    const submitted = ['Exclude EV companies', 'Prefer dividends', 'Include utilities'];
    expect(authPost).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: submitted,
    });
    expect(result.current.refinements).toEqual(submitted);
  });

  it('searches with eight staged filters', async () => {
    post.mockResolvedValueOnce(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());
    const draft = Array.from({ length: MAX_REFINEMENTS }, (_, index) => `Filter ${index + 1}`);

    act(() => {
      draft.forEach(result.current.addRefinement);
      result.current.addRefinement('One too many');
    });
    await act(async () => {
      await result.current.generate('Another extra filter');
    });

    expect(result.current.refinements).toEqual(draft);
    expect(authPost).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: draft });
  });

  it('ignores a second search while one is pending', async () => {
    post.mockResolvedValueOnce(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await Promise.all([
        result.current.generate('Prefer dividends'),
        result.current.generate('Exclude EV companies'),
      ]);
    });

    expect(authPost).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: ['Prefer dividends'],
    });
    expect(result.current.refinements).toEqual(['Prefer dividends']);
  });

  it('keeps submitted filters available for retry', async () => {
    post.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.generate('Prefer dividends');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.recommendations).toEqual([]);
    expect(result.current.refinements).toEqual(['Prefer dividends']);

    await act(async () => {
      await result.current.generate();
    });
    expect(authPost).toHaveBeenCalledTimes(2);
    expect(authPost).toHaveBeenLastCalledWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: ['Prefer dividends'],
    });
    expect(result.current.error).toBeNull();
  });

  it('addToPortfolio() uses the shared add path and does not mutate results (P9, P12)', async () => {
    post.mockResolvedValueOnce(okResponse(['MSFT', 'AAPL']));
    const { result } = renderHook(() => useDiscoveryManager());
    await act(async () => {
      await result.current.generate();
    });

    post.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.addToPortfolio('MSFT');
    });

    expect(authPost).toHaveBeenLastCalledWith(PORTFOLIO_ENDPOINTS.ADD, { symbol: 'MSFT' });
    // Generating/adding never removes a recommendation from the grid.
    expect(result.current.recommendations).toHaveLength(2);
  });

  it('goToStock() navigates to the stock route', () => {
    const { result } = renderHook(() => useDiscoveryManager());
    act(() => {
      result.current.goToStock('NVDA');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/stock/NVDA');
  });
});
