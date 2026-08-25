import { useCallback, useState } from "react";
import { BROKERAGE_ENDPOINTS } from "../constants/api";
import {
  BrokerageConnectionStatus,
  BrokerageHoldingsResponse,
  PerformanceSummary,
  PortfolioHolding,
} from "../types";
import { authGet, authPost } from "../utils/api";

const EMPTY_STATUS: BrokerageConnectionStatus = {
  connected: false,
  brokerage_name: null,
  last_synced: null,
};

export interface UseBrokerageManager {
  status: BrokerageConnectionStatus;
  holdings: PortfolioHolding[];
  performance: PerformanceSummary | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;

  fetchHoldings: () => Promise<void>;
  startConnect: () => Promise<void>;
  sync: () => Promise<void>;
  disconnect: (purgeHoldings?: boolean) => Promise<void>;
  publishToCommunity: (templateId: number | null, anonymize: boolean) => Promise<void>;
}

/**
 * Manages the brokerage import surface. Read-only: generating views never mutates
 * portfolio state. The connect flow hands off to the aggregator's hosted portal
 * via a redirect URI; on return the page calls sync().
 */
export const useBrokerageManager = (): UseBrokerageManager => {
  const [status, setStatus] = useState<BrokerageConnectionStatus>(EMPTY_STATUS);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResponse = useCallback((data: BrokerageHoldingsResponse) => {
    setStatus(data?.status ?? EMPTY_STATUS);
    setHoldings(Array.isArray(data?.holdings) ? data.holdings : []);
    setPerformance(data?.performance ?? null);
  }, []);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authGet<BrokerageHoldingsResponse>(BROKERAGE_ENDPOINTS.HOLDINGS);
      applyResponse(data);
    } catch (err) {
      console.error("Fetch holdings failed:", err);
      setError("Couldn't load your holdings.");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const startConnect = useCallback(async () => {
    setError(null);
    try {
      const data = await authPost<{ redirect_uri: string }>(BROKERAGE_ENDPOINTS.CONNECT_START, {});
      if (data?.redirect_uri) {
        // Hand off to the aggregator's hosted connection portal.
        window.location.href = data.redirect_uri;
      } else {
        setError("Couldn't start the brokerage connection.");
      }
    } catch (err) {
      console.error("Start connect failed:", err);
      setError("Couldn't start the brokerage connection.");
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const data = await authPost<BrokerageHoldingsResponse>(BROKERAGE_ENDPOINTS.SYNC, {});
      applyResponse(data);
    } catch (err) {
      console.error("Sync failed:", err);
      setError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }, [applyResponse]);

  const disconnect = useCallback(
    async (purgeHoldings = true) => {
      setError(null);
      try {
        await authPost(BROKERAGE_ENDPOINTS.DISCONNECT, { purge_holdings: purgeHoldings });
        setStatus(EMPTY_STATUS);
        if (purgeHoldings) {
          setHoldings([]);
          setPerformance(null);
        }
      } catch (err) {
        console.error("Disconnect failed:", err);
        setError("Couldn't disconnect your brokerage.");
      }
    },
    []
  );

  const publishToCommunity = useCallback(
    async (templateId: number | null, anonymize: boolean) => {
      setError(null);
      try {
        await authPost(BROKERAGE_ENDPOINTS.PUBLISH, { template_id: templateId, anonymize });
      } catch (err) {
        console.error("Publish failed:", err);
        setError("Couldn't publish your performance.");
      }
    },
    []
  );

  return {
    status,
    holdings,
    performance,
    loading,
    syncing,
    error,
    fetchHoldings,
    startConnect,
    sync,
    disconnect,
    publishToCommunity,
  };
};
