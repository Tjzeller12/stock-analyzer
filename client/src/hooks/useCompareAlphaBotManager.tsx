import { useEffect, useState } from "react";
import { RadarTemplate } from "../components/common/AdvancedSettingsPanel";
import { ALPHA_BOT_ENDPOINTS, RADAR_ENDPOINTS } from "../constants/api";
import { CHART_COLORS } from "../constants/chartColors";
import { AlphaBotResponse, ChartData, CompareResponse } from "../types";
import { authPost } from "../utils/api";

/**
 * Custom hook to manage the "Compare" functionality using the AlphaBot LLM.
 * Handles tracking which symbols are selected for comparison, persisting that state across reloads,
 * parsing complex LLM JSON outputs, and injecting UI theme colors into the resulting Chart.js datasets.
 * 
 * @returns {Object} Object containing selected symbols, loading/error states, parsed results, and control functions.
 */
export const useCompareAlphaBotManager = () => {
    // Initialize selectedSymbols from localStorage to persist selections across page refreshes
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => {
        const saved = localStorage.getItem("selectedSymbols");
        return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
    });
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [compareResult, setCompareResult] = useState<CompareResponse | null>(() => {
        const saved = localStorage.getItem("compareResult");
        return saved ? (JSON.parse(saved) as CompareResponse) : null;
    });

    const [compareRadarScores, setCompareRadarScores] = useState<ChartData | null>(() => {
        const saved = localStorage.getItem("compareRadarScores");
        if (saved && saved !== "null" && saved !== "undefined") {
            try {
                return JSON.parse(saved) as ChartData;
            } catch (e) {
                console.error("Failed to parse cached radar scores", e);
                return null;
            }
        }
        return null;
    });

    // Persist selectedSymbols whenever it changes
    useEffect(() => {
        localStorage.setItem("selectedSymbols", JSON.stringify(Array.from(selectedSymbols)));
    }, [selectedSymbols]);

    // Persist compareResult whenever it changes
    useEffect(() => {
        localStorage.setItem("compareResult", JSON.stringify(compareResult));
    }, [compareResult]);

    useEffect(() => {
        if (compareRadarScores) {
            localStorage.setItem("compareRadarScores", JSON.stringify(compareRadarScores))
        } else {
            localStorage.removeItem("compareRadarScores");
        }
    }, [compareRadarScores]);

    /**
     * Parses the raw text response from the AlphaBot LLM.
     * Specifically designed to handle "chatty" LLMs that might output conversational text 
     * before or after the actual JSON payload. It finds the first `{` and last `}` to extract the JSON.
     * 
     * @param {string | undefined} response - The raw text output from the LLM.
     * @returns {CompareResponse | null} The structured JSON data or null if parsing fails.
     */
    const parseCompareResponse = (response: string | undefined): CompareResponse | null => {
      if (!response) return null;
      try {
        // Extract JSON substring if there's extra text
        // Extract JSON substring manually to be robust against extra text
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
    
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            console.warn("No JSON found in response:", response.substring(0, 50) + "...");
            return null;
        }
    
        const jsonString = response.substring(firstBrace, lastBrace + 1);
        
        // REMOVED SANITIZER: It was breaking valid structural newlines.
        // We trust that the Regex above extracted just the JSON, and standard JSON.parse will work.
    
        const parsedResponse = JSON.parse(jsonString) as CompareResponse;

        // Inject styling into Doughnut Chart datasets
        if (parsedResponse.doughnutChartData) {
           injectDoughnutStyling(parsedResponse.doughnutChartData);
        }
    
        return parsedResponse;
      } catch (error) {
        console.error("Failed to parse compare response.", error);
        return null;
      }
    }

    /**
     * Helper function to inject theme colors into Radar Chart datasets.
     * Radar charts use the same color for the background fill and the border stroke 
     * for a single dataset (representing one stock).
     */
    /**
     * Helper function to convert the backend's raw score dictionary into 
     * the format expected by Chart.js / Recharts.
     * Also injects theme colors into Radar Chart datasets.
     */
    const buildRadarChartData = (scoresBySymbol: Record<string, Record<string, number>>): ChartData => {
        const symbols = Object.keys(scoresBySymbol);
        if (symbols.length === 0) return { labels: [], datasets: [] };

        // Assume all stocks have the same axes/categories based on the template
        const labels = Object.keys(scoresBySymbol[symbols[0]] || {});
        
        const datasets = symbols.map((symbol, index) => {
            const scores = scoresBySymbol[symbol];
            
            // Map the dictionary scores into an array matching the order of 'labels'
            const dataPnts = labels.map(label => scores[label] || 0);
            
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return {
                label: symbol,
                data: dataPnts,
                backgroundColor: color.bg,
                borderColor: color.border,
                borderWidth: 2,
                fill: true
            };
        });

        return { labels, datasets };
    }

    /**
     * Helper function to inject theme colors into Doughnut Chart datasets.
     * Doughnut charts represent data differently: a single dataset might represent multiple 
     * stocks, so each slice (data point) within the dataset needs a unique color.
     */
    const injectDoughnutStyling = (chartData: ChartData) => {
        if (chartData.datasets) {
            chartData.datasets.forEach((dataset: ChartData['datasets'][0]) => {
                // For doughnut charts, we want an array of colors corresponding to the data points
                const count = dataset.data.length;
                const backgroundColors = [];
                const borderColors = [];

                for (let i = 0; i < count; i++) {
                     const color = CHART_COLORS[i % CHART_COLORS.length];
                     backgroundColors.push(color.bg);
                     borderColors.push(color.border);
                }

                dataset.backgroundColor = backgroundColors;
                dataset.borderColor = borderColors;
                dataset.borderWidth = 2.3;
            });
        }
    }

    /**
     * Toggles a stock symbol's presence in the selected symbols Set.
     * 
     * @param {string} symbol - The ticker symbol to toggle selection for.
     */
    const toggleSelectSymbol = (symbol: string) => {
        setSelectedSymbols((prev) => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            return next;
        });
    };
    
/**
     * Triggers the AlphaBot comparison analysis on all currently selected symbols.
     * Enforces limits (min 2, max 10 symbols) before making the API call.
     * @param {string[]} validSymbols - Optional list of valid symbols. Any selected symbols not in this list will be ignored.
     * @param {RadarTemplate} template - The active template defining the axis and equations.
     */
    const compareStocks = async (validSymbols: string[], template: RadarTemplate) => {
        setCompareError(null);
        setCompareResult(null);
        setCompareRadarScores(null);
        localStorage.removeItem("compareResult");
        
        let symbols = Array.from(selectedSymbols);

        if (validSymbols && validSymbols.length > 0) {
            symbols = symbols.filter(s => validSymbols.includes(s));
            if (symbols.length !== selectedSymbols.size) {
                setSelectedSymbols(new Set(symbols));
            }
        }

        if (symbols.length < 2) {
            setCompareError("Select at least 2 stocks to compare.");
            return;
        }
        if (symbols.length > 10) {
            setCompareError("You can compare at most 10 stocks at once.");
            return;
        }

        try {
            setCompareLoading(true);

            // 1. FIRST: Await the Deterministic Radar Engine request
            const radarResult = await authPost<{scores: Record<string, Record<string, number>>}>(
                RADAR_ENDPOINTS.COMPARE, 
                { symbols, template, is_relative: true }
            );

            let calculatedScores = {};

            // If we got scores, build the chart data immediately so the UI feels fast!
            if (radarResult && radarResult.scores) {
                calculatedScores = radarResult.scores;
                const chartData = buildRadarChartData(calculatedScores);
                setCompareRadarScores(chartData);
            }

            // 2. SECOND: Fire off the LLM request, injecting the equations and the newly calculated scores!
            const alphaBotResult = await authPost<AlphaBotResponse>(
                ALPHA_BOT_ENDPOINTS.COMPARE, 
                { 
                    stock_symbols: symbols,
                    equations: template.equations, // <--- Injecting the rules
                    scores: calculatedScores       // <--- Injecting the results
                }
            );
            
            // 3. Process LLM Text + Doughnut Data
            if (alphaBotResult && alphaBotResult.response) {
                const result = parseCompareResponse(alphaBotResult.response);
                if (result) {
                    setCompareResult(result);
                } else {
                    setCompareError("Failed to parse AI analysis. The AI service may be temporarily unavailable.");
                }
            } else {
                setCompareError("AI comparison failed. You may be out of credits or the service is down.");
            }
            
        } catch (err: unknown) {
            console.error("Comparison failed:", err);
            if (
                typeof err === "object" &&
                err !== null &&
                "response" in err &&
                (err as { response?: { status?: number } }).response?.status === 429
            ) {
                setCompareError("You've used all 3 of your free AlphaBot queries for today. Come back tomorrow!");
            } else {
                setCompareError("Comparison failed. Please try again.");
            }
        } finally {
            setCompareLoading(false);
        }
    };
    return {
        selectedSymbols,
        setSelectedSymbols,
        compareLoading,
        compareError,
        compareResult,
        compareStocks,
        toggleSelectSymbol,
        compareRadarScores
    }
}