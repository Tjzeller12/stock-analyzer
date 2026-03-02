import axios from "axios";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PORTFOLIO_ENDPOINTS } from "../constants/api";
import { Stock } from "../types";
import { authPost } from "../utils/api";

/**
 * Custom hook responsible for managing the user's stock portfolio table.
 * Provides functions to fetch, add, remove, and refresh stocks, as well as 
 * sorting capabilities and navigation to detailed stock views.
 * 
 * @param {string} initialSortBy - The default column key to sort the table by when it loads.
 * @returns {Object} Object containing stock list, loading/error states, and management functions.
 */
export const useStockTableManager = (initialSortBy: string = "ev_to_ebita") => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [sortBy, setSortBy] = useState(initialSortBy);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetches the user's saved stocks from the database, ordered by the current `sortBy` value.
     * Wrapped in useCallback so it can be safely used in useEffect dependency arrays.
     */
    const fetchStocks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await authPost<Stock[]>(PORTFOLIO_ENDPOINTS.STOCKS, { sortBy });
            if (Array.isArray(data)) {
                setStocks(data);
            } else {
                setError("No stocks found.");
            }
        } catch (err) {
            console.error("Fetch stocks failed:", err);
            setError("Failed to fetch stocks.");
        } finally {
            setLoading(false);
        }
    }, [sortBy]);

    /**
     * Adds a new stock symbol to the user's portfolio and re-fetches the updated list.
     * Handles specific 400 bad request errors to notify the user if the symbol is invalid.
     * 
     * @param {string} symbol - The ticker symbol to add (e.g., "AAPL").
     */
    const addStock = async (symbol: string) => {
        setError(null);
        try {
            await authPost(PORTFOLIO_ENDPOINTS.ADD, { symbol });
            await fetchStocks(); // Refresh list after add
        } catch (err: unknown) {
            console.error("Add failed:", err);
            // Handle 400 Bad Request specifically if possible, or just general error
             if (axios.isAxiosError(err) && err.response && err.response.status === 400) {
                setError(`Invalid stock symbol: ${symbol}`);
            } else {
                setError("Failed to add stock. Please try again.");
            }
        }
    };

    /**
     * Removes a stock symbol from the user's portfolio and re-fetches the updated list.
     * 
     * @param {string} symbol - The ticker symbol to remove.
     */
    const removeStock = async (symbol: string) => {
        try {
            await authPost(PORTFOLIO_ENDPOINTS.REMOVE, { symbol });
            await fetchStocks(); // Refresh list after remove
        } catch (err) {
            console.error("Remove failed:", err);
            throw err;
        }
    };

    /**
     * Triggers a backend process to fetch the latest real-time data for all saved stocks
     * from external APIs (like AlphaVantage), then re-fetches the updated database records to display.
     */
    const refreshStocks = async () => {
        try {
            // Tells backend to update prices/data from external API
            await authPost(PORTFOLIO_ENDPOINTS.REFRESH, {});
            // Then re-fetch the updated list
            await fetchStocks(); 
        } catch (err) {
            console.error("Refresh failed:", err);
            throw err;
        }
    };

    /**
     * Navigates the user to the detailed stock analysis page for the given symbol.
     */
    const navigateToStockPage = (symbol: string) => {
        navigate(`/stock/${symbol}`);
    };

    return {
        stocks,
        loading,
        error,
        sortBy,
        fetchStocks,
        setSortBy,
        addStock,
        removeStock,
        refreshStocks,
        navigateToStockPage
    }

}