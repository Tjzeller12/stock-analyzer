import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PORTFOLIO_ENDPOINTS } from "../constants/api";
import { Stock } from "../types";
import { authPost } from "../utils/api";

export const useStockTableManager = (initialSortBy: string = "ev_to_ebita") => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [sortBy, setSortBy] = useState(initialSortBy);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const addStock = async (symbol: string) => {
        setError(null);
        try {
            await authPost(PORTFOLIO_ENDPOINTS.ADD, { symbol });
            await fetchStocks(); // Refresh list after add
        } catch (err: any) {
            console.error("Add failed:", err);
            // Handle 400 Bad Request specifically if possible, or just general error
             if (err.response && err.response.status === 400) {
                setError(`Invalid stock symbol: ${symbol}`);
            } else {
                setError("Failed to add stock. Please try again.");
            }
        }
    };

    const removeStock = async (symbol: string) => {
        try {
            await authPost(PORTFOLIO_ENDPOINTS.REMOVE, { symbol });
            await fetchStocks(); // Refresh list after remove
        } catch (err) {
            console.error("Remove failed:", err);
            throw err;
        }
    };

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