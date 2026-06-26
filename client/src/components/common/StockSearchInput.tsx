import { useState, useEffect } from "react";
import { authGet } from "../../utils/api";
import { DATA_ENDPOINTS } from "../../constants/api";

interface SearchResult {
    symbol: string;
    name: string;
    type: string;
    exchange: string;
}

interface StockSearchInputProps {
    onStockSelect: (symbol: string) => void;
    disabled?: boolean;
}

const StockSearchInput = ({ onStockSelect, disabled }: StockSearchInputProps) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // 1. useEffect that watches `query` — after 300ms calls the API
    //    hint: use a cleanup function to cancel the timeout if query changes
    // 2. handler for when user clicks a result
    //    → call onStockSelect(result.symbol), clear query, clear results
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (query.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            authGet(`${DATA_ENDPOINTS.SEARCH}?q=${query}`)
                .then(data => setResults(data as SearchResult[]))
                .catch(error => console.error("Error searching for stocks:", error))
                .finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(timeout);
    }, [query]);
    return (
        <div className="relative bg-input-bg border border-border-main/40 rounded-lg px-2 py-0.5 my-0.5 flex items-center shadow-inner transition-all hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
            <input 
                className="mr-0 h-8 border-none bg-transparent outline-none flex-1 text-sm text-text-main placeholder-text-main/50 px-2"
                type="text" 
                placeholder="Search for a stock"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={disabled}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
            />  
            {(loading || results.length > 0) && (
                <div className="absolute top-full left-0 w-full bg-list-bg border border-border-main rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                    {loading ? (
                        <div className="px-4 py-2 text-sm text-text-main/50">Loading...</div>
                    ) : (
                        results.map(result => (
                            <div
                                key={result.symbol}
                                className="px-4 py-2 text-sm text-text-main hover:bg-row-hover flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{result.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-text-main/50 font-mono text-xs">{result.symbol}</span>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); onStockSelect(result.symbol); setQuery(""); setResults([]); }}
                                        className="w-5 h-5 rounded-full border-2 border-primary hover:bg-primary/10 active:scale-90 flex items-center justify-center transition-all"
                                        title={`Add ${result.symbol}`}
                                    >
                                        <svg className="w-2.5 h-2.5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default StockSearchInput;
