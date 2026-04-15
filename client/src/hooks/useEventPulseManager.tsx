import { useState, useRef, useEffect } from 'react';
import { authPost } from '../utils/api';
import { ALPHA_BOT_ENDPOINTS } from '../constants/api';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';
export const timeFrames: TimeFrame[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export interface ClickedPoint {
    time: number;
    price: number;
    rawDateStr: string;
}

export type SelectionPhase = 'idle' | 'selecting' | 'selected';

/**
 * Custom hook to manage the Lightweight Charts selection logic, bounding anchors,
 * and calling the forensic AlphaBot "Event Pulse" analysis endpoint when a gap is selected.
 * 
 * @param {string | undefined} symbol - The target stock symbol (e.g. "AAPL").
 * @param {React.RefObject<HTMLDivElement | null>} windowOverlayRef - DOM Ref used to physically render the blue selection box.
 * @returns {Object} Pulse phase modes, anchors, forensic results, and the selection mutators.
 */
export const useEventPulseManager = (symbol: string | undefined, windowOverlayRef: React.RefObject<HTMLDivElement | null>) => {
    // Event Pulse Selection State
    const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>('idle');
    const selectionPhaseRef = useRef<SelectionPhase>('idle');
    const [anchorStart, setAnchorStart] = useState<ClickedPoint | null>(null);
    const anchorStartRef = useRef<ClickedPoint | null>(null);
    const [anchorEnd, setAnchorEnd] = useState<ClickedPoint | null>(null);
    const anchorEndRef = useRef<ClickedPoint | null>(null);
    const hoverTimeRef = useRef<number | null>(null);
    
    // Status / Error / AI State
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    // Update tracking Refs immediately
    useEffect(() => { selectionPhaseRef.current = selectionPhase; }, [selectionPhase]);
    useEffect(() => { anchorStartRef.current = anchorStart; }, [anchorStart]);
    useEffect(() => { anchorEndRef.current = anchorEnd; }, [anchorEnd]);

    // Fetch forensic analysis when the range is firmly selected
    useEffect(() => {
        if (selectionPhase === 'selected' && anchorStart && anchorEnd && symbol) {
            const fetchAnalysis = async () => {
                setIsAnalyzing(true);
                setAnalysisResult(null); 
                setSelectionError(null);
                
                // Dynamically deduce if it was a rally or crash
                const swingType = anchorEnd.price > anchorStart.price ? 'Massive Rally' : 'Major Sell-off';

                try {
                    const response = await authPost<{ response: string }>(ALPHA_BOT_ENDPOINTS.EVENT_PULSE, {
                        stock_symbol: symbol,
                        start_date_str: anchorStart.rawDateStr,
                        start_price: anchorStart.price,
                        date_str: anchorEnd.rawDateStr,
                        price: anchorEnd.price,
                        swing_type: swingType,
                        timestamp: anchorEnd.time // Legacy pass-through
                    });
                    if (response.response) {
                        setAnalysisResult(response.response);
                    }
                } catch (err) {
                    console.error("Forensic analysis failed", err);
                    setAnalysisResult("System Error: Failed to analyze this highlighted range. Please try again.");
                } finally {
                    setIsAnalyzing(false);
                }
            };

            void fetchAnalysis();
        }
    }, [selectionPhase, anchorStart, anchorEnd, symbol]);

    /**
     * Instantly aborts the Pulse highlighting tool and resets all bounding constraints to idle.
     */
    const clearPulse = () => {
        setSelectionPhase('idle');
        setAnchorStart(null);
        setAnchorEnd(null);
        setAnalysisResult(null);
        setIsAnalyzing(false);
        setSelectionError(null);
        if (windowOverlayRef.current) {
            windowOverlayRef.current.style.display = 'none';
        }
    };

    return {
        selectionPhase,
        setSelectionPhase,
        selectionPhaseRef,
        anchorStart,
        setAnchorStart,
        anchorStartRef,
        anchorEnd,
        setAnchorEnd,
        anchorEndRef,
        hoverTimeRef,
        selectionError,
        setSelectionError,
        isAnalyzing,
        analysisResult,
        setAnalysisResult,
        clearPulse
    };
};
