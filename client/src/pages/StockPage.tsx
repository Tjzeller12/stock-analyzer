/**
 * StockPage component
 * Detailed view for a specific stock, displaying metrics, charts, news sentiment, and AI analysis.
 * Uses StockHeader and StockMetricsTable extracted components.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StyledMarkdown from "../components/common/StyledMarkdown";
import StockHeader from "../components/StockHeader";
import StockMetricsTable from "../components/StockMetricsTable";
import { ALPHA_BOT_ENDPOINTS, DATA_ENDPOINTS } from '../constants/api';
import logo from "../resources/alphaBotLogo.png";
import { authPost } from '../utils/api';
import EventPulseChart from "../components/charts";

import { Stock } from '../types';

const StockPage: React.FC = () => {
  const navigate = useNavigate();
  const { symbol } = useParams<{ symbol: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [queryResult] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState("");
  const [timeFrame, setTimeFrame] = useState('1D');
  const [chartData, setChartData] = useState<any[]>([]);

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

  const fetchAlphaBotInDepthAnalysis = async () => {
    if (!symbol) return;
    try {
      const response = await authPost<{ response: string }>(ALPHA_BOT_ENDPOINTS.IN_DEPTH, { stock_symbol: symbol });
      if (response.response) {
        setSummary(response.response);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

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
    void fetchAlphaBotInDepthAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    void fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeFrame]);

  const handleLogoClick = () => {
    navigate("/main");
  };

    // --- Calculate Sentiment from Alpha Vantage article feed ---
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


  return (
    <div className="flex flex-col items-center min-h-screen p-0 font-sans bg-background text-text-main">
      <StockHeader stock={stock} onLogoClick={handleLogoClick} logo={logo} />
      <EventPulseChart 
        symbol={symbol || ''} 
        data={chartData} 
        activeTimeFrame={timeFrame as any}
        onTimeFrameChange={setTimeFrame}
      />
      <StockMetricsTable stock={stock} />

      <div className="flex flex-col lg:flex-row items-stretch gap-4 w-[97.5%] h-full bg-list-bg p-4 rounded-xl shadow-lg border border-border-main/10 mt-4">
        <div className="flex flex-col items-center gap-3 bg-list-bg p-4 rounded-lg w-full lg:w-[60%] text-center shadow-md border border-border-main/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10"></div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight">In Depth Analysis</span>
          </div>
          <div className="flex flex-col items-start gap-4 bg-form-bg p-4 rounded-lg w-[95%] min-h-[300px] h-full text-left shadow-inner border border-border-main/10">
            {summary ? <StyledMarkdown>{summary}</StyledMarkdown> : "Loading analysis..."}
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 bg-list-bg p-4 w-full lg:w-[40%] rounded-lg text-center shadow-md border border-border-main/5 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
          <div className="flex flex-col items-center gap-2 w-full">
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight w-full">Alpha Bot Summary</span>
          </div>
          <div className="flex flex-col items-start gap-4 bg-form-bg p-4 rounded-lg w-[95%] min-h-[300px] h-full mx-auto shadow-inner border border-border-main/10">
            <div className="text-left w-full text-sm">{queryResult || "Loading response..."}</div>
          </div>
          <div className="flex gap-3 my-2 mx-auto w-[95%] relative">
            <input
              type="text"
              placeholder="Ask about this stock..."
              className="flex-1 p-2.5 rounded-lg text-sm bg-input-bg text-text-main border border-border-main/40 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner transition-all w-full"
              value={llmPrompt}
              onChange={(e) => setLlmPrompt(e.target.value)}
            />
          </div>
          {totalArticles > 0 && (
            <div className="flex flex-row justify-around items-center gap-4 bg-form-bg p-3 rounded-lg mt-2 text-xs font-semibold w-full shadow-md border border-border-main/10">
              <div>
                Positive: {positiveScore.toFixed(1)}%
              </div>
              <div>
                Neutral: {neutralScore.toFixed(1)}%
              </div>
              <div>
                Negative: {negativeScore.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockPage;
