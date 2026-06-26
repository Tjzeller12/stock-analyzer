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

describe('useDiscoveryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generate() populates recommendations and hasProfile', async () => {
    (authPost as any).mockResolvedValueOnce(okResponse(['MSFT', 'AAPL']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.generate();
    });

    expect(authPost).toHaveBeenCalledWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: [] });
    expect(result.current.recommendations).toHaveLength(2);
    expect(result.current.hasProfile).toBe(true);
    expect(result.current.hasGenerated).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('refine() appends in order and resends the full list (P4)', async () => {
    (authPost as any).mockResolvedValue(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.refine('Exclude EV companies');
    });
    await act(async () => {
      await result.current.refine('Prefer dividends');
    });

    expect(result.current.refinements).toEqual(['Exclude EV companies', 'Prefer dividends']);
    expect(authPost).toHaveBeenLastCalledWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: ['Exclude EV companies', 'Prefer dividends'],
    });
  });

  it('refine() ignores empty/whitespace input', async () => {
    const { result } = renderHook(() => useDiscoveryManager());
    await act(async () => {
      await result.current.refine('   ');
    });
    expect(authPost).not.toHaveBeenCalled();
    expect(result.current.refinements).toEqual([]);
  });

  it('refine() enforces the refinement cap (P5)', async () => {
    (authPost as any).mockResolvedValue(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    for (let i = 0; i < MAX_REFINEMENTS; i++) {
      await act(async () => {
        await result.current.refine(`refinement ${i}`);
      });
    }
    (authPost as any).mockClear();

    await act(async () => {
      await result.current.refine('one too many');
    });

    expect(result.current.refinements).toHaveLength(MAX_REFINEMENTS);
    expect(authPost).not.toHaveBeenCalled();
    expect(result.current.error).toContain(String(MAX_REFINEMENTS));
  });

  it('removeRefinement() drops one and re-runs', async () => {
    (authPost as any).mockResolvedValue(okResponse(['MSFT']));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.refine('a');
    });
    await act(async () => {
      await result.current.refine('b');
    });
    await act(async () => {
      await result.current.removeRefinement(0);
    });

    expect(result.current.refinements).toEqual(['b']);
    expect(authPost).toHaveBeenLastCalledWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: ['b'] });
  });

  it('clears loading even when the request fails (P8)', async () => {
    (authPost as any).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useDiscoveryManager());

    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.recommendations).toEqual([]);
  });

  it('addToPortfolio() uses the shared add path and does not mutate results (P9, P12)', async () => {
    (authPost as any).mockResolvedValueOnce(okResponse(['MSFT', 'AAPL']));
    const { result } = renderHook(() => useDiscoveryManager());
    await act(async () => {
      await result.current.generate();
    });

    (authPost as any).mockResolvedValueOnce({});
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
