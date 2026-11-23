import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BROKERAGE_ENDPOINTS } from '../../constants/api';
import { authGet, authPost } from '../../utils/api';
import { useBrokerageManager } from '../useBrokerageManager';

vi.mock('../../utils/api', () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
}));

const holdingsResponse = (connected = true) => ({
  status: { connected, brokerage_name: 'Robinhood', last_synced: '2026-06-25T00:00:00' },
  holdings: [
    {
      // Holdings now carry full stock data (so they render in the same table + radar)
      // merged with broker position fields.
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      price: 210,
      pe_ratio: 32,
      quantity: 10,
      avg_cost: 150,
      current_price: 210,
      market_value: 2100,
      cost_basis: 1500,
      unrealized_pnl: 600,
      unrealized_pnl_pct: 40,
    },
  ],
  performance: {
    total_value: 2100,
    total_cost_basis: 1500,
    total_return: 600,
    total_return_pct: 40,
    last_synced: '2026-06-25T00:00:00',
  },
});

describe('useBrokerageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchHoldings populates status, holdings, and performance', async () => {
    (authGet as any).mockResolvedValueOnce(holdingsResponse());
    const { result } = renderHook(() => useBrokerageManager());

    await act(async () => {
      await result.current.fetchHoldings();
    });

    expect(authGet).toHaveBeenCalledWith(BROKERAGE_ENDPOINTS.HOLDINGS);
    expect(result.current.status.connected).toBe(true);
    expect(result.current.holdings).toHaveLength(1);
    expect(result.current.performance?.total_return_pct).toBe(40);
    expect(result.current.loading).toBe(false);
  });

  it('startConnect redirects to the aggregator portal', async () => {
    (authPost as any).mockResolvedValueOnce({ redirect_uri: 'https://portal.snaptrade.com/abc' });
    // jsdom doesn't allow assigning window.location.href directly; stub it.
    const original = window.location;
    // @ts-expect-error override for test
    delete window.location;
    // @ts-expect-error minimal stub
    window.location = { href: '' };
    const { result } = renderHook(() => useBrokerageManager());

    await act(async () => {
      await result.current.startConnect();
    });

    expect(authPost).toHaveBeenCalledWith(BROKERAGE_ENDPOINTS.CONNECT_START, {});
    expect(window.location.href).toBe('https://portal.snaptrade.com/abc');
    // @ts-expect-error restore
    window.location = original;
  });

  it('sync applies the returned holdings view', async () => {
    (authPost as any).mockResolvedValueOnce(holdingsResponse());
    const { result } = renderHook(() => useBrokerageManager());

    await act(async () => {
      await result.current.sync();
    });

    expect(authPost).toHaveBeenCalledWith(BROKERAGE_ENDPOINTS.SYNC, {});
    expect(result.current.holdings[0].symbol).toBe('AAPL');
    expect(result.current.syncing).toBe(false);
  });

  it('disconnect clears state and calls the purge endpoint', async () => {
    (authPost as any).mockResolvedValueOnce(holdingsResponse());
    const { result } = renderHook(() => useBrokerageManager());
    await act(async () => {
      await result.current.sync();
    });

    (authPost as any).mockResolvedValueOnce({ disconnected: true });
    await act(async () => {
      await result.current.disconnect(true);
    });

    expect(authPost).toHaveBeenLastCalledWith(BROKERAGE_ENDPOINTS.DISCONNECT, { purge_holdings: true });
    expect(result.current.status.connected).toBe(false);
    expect(result.current.holdings).toHaveLength(0);
  });

  it('clears loading even when fetch fails', async () => {
    (authGet as any).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useBrokerageManager());

    await act(async () => {
      await result.current.fetchHoldings();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
