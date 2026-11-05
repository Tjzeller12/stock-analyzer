/**
 * StockPage component
 * Detailed view for a specific stock, displaying metrics, charts, news sentiment, and AI analysis.
 * Uses StockHeader and StockMetricsTable extracted components.
 */
import React, { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import Card from "../components/common/Card";
import Header from "../components/common/Header";
import StyledMarkdown from "../components/common/StyledMarkdown";
import StockHeader from "../components/StockHeader";
import StockMetricsTable from "../components/common/StockMetricsTable";
import RadarGraph from "../components/common/RadarGraph";
import EventPulseChart from "../components/charts";
import { ChartData } from '../types';

// Import our custom hooks
import { useStockDataManager } from "../hooks/useStockDataManager";
import { useStockAnalysisManager } from "../hooks/useStockAnalysisManager";
import { healthColor, healthScore } from "../utils/healthColor";

const StockPage: React.FC = () => {
  const location = useLocation();
  const { symbol } = useParams<{ symbol: string }>();
  
  const initialRadarScores = (location.state as { radarScores?: Record<string, number> } | null)?.radarScores ?? null;

  // Use Custom Hooks
  const { 
    stock, radarScores, timeFrame, setTimeFrame, chartData 
  } = useStockDataManager(symbol, initialRadarScores);
  
  const {
    summary, summaryIsLoading, summaryIsStreaming, summaryToolsRunning, summaryToolMessage,
    showChat, setShowChat,
    chatMessages, chatInput, setChatInput,
    chatLoading, chatIsStreaming, chatToolsRunning, chatToolMessage,
    chatEndRef, sendChat,
  } = useStockAnalysisManager(symbol);

  // Compute ChartData for RadarGraph from radar scores
  const radarChartData: ChartData | null = useMemo(() => {
    if (!radarScores || !stock) return null;
    const labels = Object.keys(radarScores);
    const dataPts = labels.map(l => radarScores[l]);
    const { borderColor, bgColor } = healthColor(healthScore(radarScores, labels));
    return {
      labels,
      datasets: [{ label: stock.symbol, data: dataPts, backgroundColor: bgColor, borderColor, borderWidth: 2, fill: true }],
    };
  }, [radarScores, stock]);

  return (
    <div className="flex flex-col min-h-screen p-0 text-text-main">
      <div className="sticky top-0 z-50">
        <Header title={stock ? `${stock.symbol} Quote` : "Quote"} />
      </div>
      <div className="flex flex-col gap-5 p-5 max-w-[1800px] mx-auto w-full">
      <StockHeader stock={stock} />
      <Card title="Price History" variant="glass" live>
        <EventPulseChart 
          symbol={symbol || ''} 
          data={chartData} 
          activeTimeFrame={timeFrame as any}
          onTimeFrameChange={setTimeFrame}
        />
      </Card>
      <StockMetricsTable stock={stock} />

      {/* ── Bottom Row: Alpha Bot Analysis (2/3) + Radar Score (1/3) ── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-5 w-full mb-8">

        {/* Alpha Bot Analysis — 2/3 width */}
        <Card
          title="AlphaBot Analysis"
          variant="glass"
          className="lg:w-[66%] text-left"
          actions={(
            <button
              onClick={() => setShowChat(c => !c)}
              className={`tg-btn ${showChat ? 'tg-btn-primary' : ''}`}
            >
              {showChat ? 'View Analysis' : 'Open Chat'}
            </button>
          )}
        >
          <div className="flex flex-col gap-3 h-full">

          {/* Analysis view */}
          {!showChat && (
            <div className="flex flex-col items-start gap-4 p-4 rounded-xl w-full min-h-[300px] h-full text-left bg-black/5 dark:bg-black/30 shadow-inner border border-[var(--tg-hairline)] overflow-y-auto">
              {summaryIsLoading && !summary ? (
                <div className="flex flex-col items-center justify-center w-full h-full gap-3 py-8">
                  <span className="alpha-bot-spinner" />
                  <p className="text-sm font-semibold text-primary animate-pulse">
                    {summaryToolMessage || (summaryToolsRunning > 0
                      ? `Fetching ${summaryToolsRunning} data source${summaryToolsRunning !== 1 ? 's' : ''}…`
                      : 'Generating analysis… may take up to two minutes.'
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {summary && <StyledMarkdown>{summary}</StyledMarkdown>}
                  {summaryIsStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                  )}
                  {!summary && !summaryIsLoading && (
                    <span className="text-text-main/40 text-sm">No analysis available.</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Chat view */}
          {showChat && (
            <div className="flex flex-col flex-1 min-h-[360px] h-full">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 rounded-xl p-4 bg-black/5 dark:bg-black/30 shadow-inner border border-[var(--tg-hairline)] min-h-[280px] max-h-[420px]">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-text-main/30">
                    <span className="text-sm font-medium">Ask anything about {symbol}...</span>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${ msg.role === 'user' ? 'justify-end' : 'justify-start' }`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-white/50 dark:bg-white/5 border border-[var(--tg-hairline)] text-text-main rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' ? (
                        msg.content ? (
                          <>
                            <StyledMarkdown>{msg.content}</StyledMarkdown>
                            {msg.isStreaming && (
                              <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 align-middle animate-pulse" />
                            )}
                          </>
                        ) : (
                          /* Empty placeholder while first chunk hasn't arrived yet */
                          chatToolsRunning > 0 || chatToolMessage ? (
                            <span className="text-xs text-text-main/50 animate-pulse">
                              {chatToolMessage || `Fetching ${chatToolsRunning} source${chatToolsRunning !== 1 ? 's' : ''}…`}
                            </span>
                          ) : (
                            <span className="flex gap-1 items-center">
                              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
                            </span>
                          )
                        )
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input row */}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder={`Ask about ${symbol}...`}
                  className="tg-input flex-1 px-4 py-2.5 text-sm"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void sendChat(); }}
                  disabled={chatLoading}
                />
                <button
                  onClick={() => void sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="tg-btn tg-btn-primary !text-sm !px-4"
                >
                  Send
                </button>
              </div>
            </div>
          )}
          </div>
        </Card>

        {/* Radar Score — 1/3 width */}
        <Card title="Radar Score" variant="glass" className="lg:w-[33%]">
          <div className="flex justify-center items-center h-full">
          {radarChartData ? (
            <RadarGraph data={radarChartData} height={320} />
          ) : (
            <div className="flex items-center justify-center h-[320px] text-text-main/30 text-sm">Loading radar...</div>
          )}
          </div>
        </Card>

      </div>
      </div>
    </div>
  );
};

export default StockPage;
