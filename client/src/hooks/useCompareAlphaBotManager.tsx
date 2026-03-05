import { useEffect, useState } from "react";
import { ALPHA_BOT_ENDPOINTS } from "../constants/api";
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

    // Persist selectedSymbols whenever it changes
    useEffect(() => {
        localStorage.setItem("selectedSymbols", JSON.stringify(Array.from(selectedSymbols)));
    }, [selectedSymbols]);

    // Persist compareResult whenever it changes
    useEffect(() => {
        if (compareResult) {
            localStorage.setItem("compareResult", JSON.stringify(compareResult));
        }
    }, [compareResult]);

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
        
        // Inject styling into Radar Chart datasets
        if (parsedResponse.radarChartData) {
           injectChartStyling(parsedResponse.radarChartData);
        }

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
    const injectChartStyling = (chartData: ChartData) => {
        if (chartData.datasets) {
            chartData.datasets.forEach((dataset: ChartData['datasets'][0], index: number) => {
                const color = CHART_COLORS[index % CHART_COLORS.length];
                dataset.backgroundColor = color.bg;
                dataset.borderColor = color.border;
                dataset.borderWidth = 2;
                dataset.fill = true;
            });
        }
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
     */
    const compareStocks = async (validSymbols?: string[]) => {
        setCompareError(null);
        setCompareResult(null);
        // Clear previous result from storage when starting new comparison
        localStorage.removeItem("compareResult");
        
        let symbols = Array.from(selectedSymbols);

        // Filter out stale symbols (e.g., symbols from previous sessions that are no longer in the user's portfolio)
        if (validSymbols && validSymbols.length > 0) {
            symbols = symbols.filter(s => validSymbols.includes(s));
            if (symbols.length !== selectedSymbols.size) {
                // Update state silently so the UI drops the stale selections without throwing an error
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
            const alphaBotResponse: AlphaBotResponse | null = await authPost<AlphaBotResponse>(ALPHA_BOT_ENDPOINTS.COMPARE, { stock_symbols: symbols });
            
            // Check if the response is actually an error message string that we couldn't parse
            try {
                const result = parseCompareResponse(alphaBotResponse?.response);
                setCompareResult(result);
            } catch (parseError: unknown) {
                // If parseCompareResponse threw an error, it's likely a text error message from the backend
                if (parseError instanceof Error) {
                    setCompareError(parseError.message);
                } else {
                    setCompareError("Failed to analyze stocks. The AI service may be temporarily unavailable.");
                }
            }
            
        } catch (err: unknown) {
            console.error("Comparison failed:", err);
            setCompareError("Comparison failed. Please try again.");
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
        toggleSelectSymbol
    }
}