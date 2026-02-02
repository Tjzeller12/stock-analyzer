import { useState } from "react";
import { CHART_COLORS } from "../components/common/RadarGraph";
import { ALPHA_BOT_ENDPOINTS } from "../constants/api";
import { AlphaBotResponse, CompareResponse } from "../types";
import { authPost } from "../utils/api";

export const useCompareAlphaBotManager = () => {
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

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
    
        const parsedResponse = JSON.parse(jsonString);
        
        // Inject styling into Radar Chart datasets
        if (parsedResponse.radarChartData && parsedResponse.radarChartData.datasets) {
           parsedResponse.radarChartData.datasets.forEach((dataset: any, index: number) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              dataset.backgroundColor = color.bg;
              dataset.borderColor = color.border;
              dataset.borderWidth = 2;
              dataset.fill = true;
           });
        }
    
        return parsedResponse;
      } catch (error) {
        console.error("Failed to parse compare response.", error);
        return null;
      }
    }

    
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
    
    const compareStocks = async () => {
        setCompareError(null);
        setCompareResult(null);
        const symbols = Array.from(selectedSymbols);
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
            const result = parseCompareResponse(alphaBotResponse?.response);
            setCompareResult(result);
        } catch (err) {
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