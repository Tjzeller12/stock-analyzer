/**
 * StockPage component
 * Detailed view for a specific stock, displaying metrics, charts, news sentiment, and AI analysis.
 * Uses StockHeader and StockMetricsTable extracted components.
 */
import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import StyledMarkdown from "../components/common/StyledMarkdown";
import StockHeader from "../components/StockHeader";
import StockMetricsTable from "../components/common/StockMetricsTable";
import RadarGraph from "../components/common/RadarGraph";
import logo from "../resources/alphaBotLogo.png";
import EventPulseChart from "../components/charts";
import { ChartData } from '../types';

// Import our custom hooks
import { useStockDataManager } from "../hooks/useStockDataManager";
import { useStockAnalysisManager } from "../hooks/useStockAnalysisManager";

const StockPage: React.FC = () => {
  const navigate = useNavigate();
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
    const totalScore = dataPts.reduce((a, b) => a + b, 0);
    let borderColor = '#069042';
    let bgColor = 'rgba(6, 144, 66, 0.3)';
    if (totalScore < 300) { borderColor = '#ef4444'; bgColor = 'rgba(239,68,68,0.3)'; }
    else if (totalScore <= 400) { borderColor = '#eab308'; bgColor = 'rgba(234,179,8,0.3)'; }
    return {
      labels,
      datasets: [{ label: stock.symbol, data: dataPts, backgroundColor: bgColor, borderColor, borderWidth: 2, fill: true }],
    };
  }, [radarScores, stock]);

  const handleLogoClick = () => {
    navigate("/main");
  };

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

      {/* ── Bottom Row: Alpha Bot Analysis (2/3) + Radar Score (1/3) ── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 w-[97.5%] h-full bg-list-bg p-4 rounded-xl shadow-lg border border-border-main/10 mt-4 mb-8">

        {/* Alpha Bot Analysis — 2/3 width */}
        <div className="flex flex-col gap-3 bg-list-bg p-4 rounded-lg w-full lg:w-[66%] shadow-md border border-border-main/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -z-10" />

          {/* Header row */}
          <div className="flex items-center justify-between w-full">
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight">
              Alpha Bot Analysis
            </span>
            <button
              onClick={() => setShowChat(c => !c)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                showChat
                  ? 'bg-primary/20 border-primary/40 text-primary'
                  : 'bg-form-bg border-border-main/20 text-text-main/60 hover:border-primary/30 hover:text-primary/80'
              }`}
            >
              <span>{showChat ? 'View Analysis' : 'Open Chat'}</span>
            </button>
          </div>

          {/* Analysis view */}
          {!showChat && (
            <div className="flex flex-col items-start gap-4 bg-form-bg p-4 rounded-lg w-full min-h-[300px] h-full text-left shadow-inner border border-border-main/10 overflow-y-auto">
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
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 bg-form-bg rounded-lg p-4 shadow-inner border border-border-main/10 min-h-[280px] max-h-[420px]">
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
                        : 'bg-list-bg border border-border-main/15 text-text-main rounded-bl-sm'
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
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-input-bg text-text-main border border-border-main/30 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void sendChat(); }}
                  disabled={chatLoading}
                />
                <button
                  onClick={() => void sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40 hover:bg-primary/80 transition-all shadow-md"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Radar Score — 1/3 width */}
        <div className="flex flex-col items-center gap-2 bg-list-bg p-4 rounded-lg w-full lg:w-[33%] shadow-md border border-border-main/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight w-full text-center">Radar Score</span>
          {radarChartData ? (
            <RadarGraph data={radarChartData} height={320} />
          ) : (
            <div className="flex items-center justify-center h-[320px] text-text-main/30 text-sm">Loading radar...</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StockPage;
