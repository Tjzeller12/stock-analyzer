import { useState, useEffect } from 'react';
import { DATA_ENDPOINTS, RADAR_ENDPOINTS } from '../constants/api';
import { DEFAULT_TEMPLATE } from '../components/common/AdvancedSettingsPanel';
import { authPost } from '../utils/api';
import { Stock } from '../types';

/**
 * Custom hook responsible for fetching and managing global stock data, charting data,
 * depth analysis, and automated sentiment calculations for a single asset.
 * 
 * @param {string | undefined} symbol - The stock ticker symbol being analyzed.
 * @param {Record<string, number> | null} initialRadarScores - Pre-fetched radar scores, or null if a fetch is needed.
 * @returns {Object} Object containing stock properties, dynamic chart sets, and fetch statuses.
 */
export const useStockDataManager = (
  symbol: string | undefined,
  initialRadarScores: Record<string, number> | null
) => {
  const [stock, setStock] = useState<Stock | null>(null);
  const [radarScores, setRadarScores] = useState<Record<string, number> | null>(initialRadarScores);
  const [loading, setLoading] = useState(false);
  const [timeFrame, setTimeFrame] = useState('1D');
  const [chartData, setChartData] = useState<any[]>([]);

  /**
   * Fetches core identifying data, real-time price info, and general meta attributes for the symbol.
   */
  const fetchStock = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const stockData = await authPost<Stock>(DATA_ENDPOINTS.STOCK, { symbol });
      setStock(stockData);
    } catch (error) {
      console.error("Stock fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches advanced fundamental data, institutional holding details, and SEC filing summaries.
   */
  const fetchInDepthData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const inDepthData = await authPost<Stock>(DATA_ENDPOINTS.IN_DEPTH, { symbol });
      setStock(inDepthData);
    } catch (error) {
      console.error("In-depth data fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Asynchronously calculates internal radar metrics for the stock against a defined template.
   */
  const fetchRadarScores = async () => {
    if (!symbol) return;
    try {
      const data = await authPost<{ scores: Record<string, number>; symbol: string }>(
        RADAR_ENDPOINTS.SINGLE,
        { symbol, template: DEFAULT_TEMPLATE }
      );
      if (data?.scores) setRadarScores(data.scores);
    } catch (error) {
      console.error("Radar score fetch failed:", error);
    }
  };

  /**
   * Requests specific, granular time-series data mappings for the active charting timeframe.
   */
  const fetchChartData = async () => {
    if (!symbol) return;
    try {
      const data = await authPost<any[]>(DATA_ENDPOINTS.CHART, { symbol, timeFrame });
      if (Array.isArray(data)) {
        setChartData(data);
      }
    } catch (error) {
      console.error("Chart data fetch failed:", error);
    }
  };

  useEffect(() => {
    void fetchStock();
    void fetchInDepthData();
    if (!initialRadarScores) {
      void fetchRadarScores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    void fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeFrame]);

  // Calculate Sentiment from Alpha Vantage article feed
  const feed = stock?.news_sentiment_data?.feed || [];
  const totalArticles = feed.length;
  let positiveScore = 0;
  let neutralScore = 0;
  let negativeScore = 0;

  if (totalArticles > 0) {
    feed.forEach(article => {
      const label = article.overall_sentiment_label || "";
      if (label.includes("Bullish")) positiveScore++;
      else if (label.includes("Bearish")) negativeScore++;
      else neutralScore++;
    });

    positiveScore = (positiveScore / totalArticles) * 100;
    neutralScore = (neutralScore / totalArticles) * 100;
    negativeScore = (negativeScore / totalArticles) * 100;
  }

  return {
    stock,
    radarScores,
    loading,
    timeFrame,
    setTimeFrame,
    chartData,
    totalArticles,
    positiveScore,
    neutralScore,
    negativeScore
  };
};