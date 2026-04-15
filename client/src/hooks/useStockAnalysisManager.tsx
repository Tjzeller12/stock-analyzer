import { useState, useRef, useEffect } from 'react';
import { ALPHA_BOT_ENDPOINTS } from '../constants/api';
import { authPost } from '../utils/api';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

/**
 * Custom hook to abstract AlphaBot's AI analysis generation and chat interaction state.
 * 
 * @param {string | undefined} symbol - The stock ticker currently being conversed about.
 * @returns {Object} Chat message sequences, chat loading states, and summary analysis.
 */
export const useStockAnalysisManager = (symbol: string | undefined) => {
  const [summary, setSummary] = useState<string | null>(null);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /**
   * Invokes an intensive LLM sequence to summarize the fundamentals and narrative of the stock.
   */
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

  /**
   * Fires a user query against AlphaBot trained on the specific stock context window.
   * Modifies the internal array of chat messages asynchronously as AI streaming arrives.
   * 
   * @param {string} [inputStr] - The prompt. Safely defaults to `chatInput` state if omitted.
   */
  const sendChat = async (inputStr?: string) => {
    const textToUse = inputStr ?? chatInput;
    const trimmed = textToUse.trim();
    if (!trimmed || !symbol || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setChatMessages(prev => [...prev, userMsg]);
    
    if (!inputStr) {
      setChatInput('');
    }
    setChatLoading(true);
    
    try {
      const data = await authPost<{ response: string }>(ALPHA_BOT_ENDPOINTS.USER_QUERY, {
        stock_symbol: symbol,
        user_query: trimmed,
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error fetching response.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  useEffect(() => {
    void fetchAlphaBotInDepthAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return {
    summary,
    showChat,
    setShowChat,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatEndRef,
    sendChat
  };
};
