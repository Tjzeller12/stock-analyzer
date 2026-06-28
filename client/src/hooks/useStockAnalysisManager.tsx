import { useState, useRef, useEffect } from 'react';
import { ALPHA_BOT_ENDPOINTS } from '../constants/api';
import { useAlphaBotStream } from './useAlphaBotStream';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    /** True while the assistant is still streaming this message. */
    isStreaming?: boolean;
}

/**
 * Custom hook to abstract AlphaBot's AI analysis generation and chat interaction state.
 * 
 * @param {string | undefined} symbol - The stock ticker currently being conversed about.
 * @returns {Object} Chat message sequences, chat loading states, and summary analysis.
 */
export const useStockAnalysisManager = (symbol: string | undefined) => {
  // ── In-depth summary stream ──────────────────────────────────────
  const summaryStream = useAlphaBotStream();

  // ── Chat state ───────────────────────────────────────────────────
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // One stream instance shared across all chat turns.  Each ``sendChat``
  // call resets it and starts a fresh stream.
  const chatStream = useAlphaBotStream();

  /**
   * Keep the last assistant message in the array in sync with the live
   * chat stream as chunks arrive, then mark it complete on ``done``.
   */
  useEffect(() => {
    if (!chatStream.isLoading && !chatStream.streamingText) return;
    setChatMessages((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          content: chatStream.streamingText || last.content,
          isStreaming: chatStream.isStreaming,
        },
      ];
    });
  }, [chatStream.streamingText, chatStream.isStreaming, chatStream.isLoading]);

  /**
   * Invokes an intensive LLM sequence to summarize the fundamentals and
   * narrative of the stock.  Streams the response in real time.
   */
  const fetchAlphaBotInDepthAnalysis = () => {
    if (!symbol) return;
    summaryStream.reset();
    void summaryStream.start(ALPHA_BOT_ENDPOINTS.IN_DEPTH_STREAM, {
      stock_symbol: symbol,
    });
  };

  /**
   * Fires a user query against AlphaBot with the stock symbol as context.
   * Appends a streaming assistant message to ``chatMessages`` in real time.
   *
   * @param {string} [inputStr] - The prompt. Defaults to ``chatInput`` state.
   */
  const sendChat = async (inputStr?: string) => {
    const textToUse = inputStr ?? chatInput;
    const trimmed = textToUse.trim();
    if (!trimmed || !symbol || chatStream.isLoading) return;

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed },
      // Placeholder assistant message that will be updated via the effect above
      { role: 'assistant', content: '', isStreaming: true },
    ]);

    if (!inputStr) setChatInput('');

    try {
      await chatStream.start(ALPHA_BOT_ENDPOINTS.USER_QUERY_STREAM, {
        stock_symbol: symbol,
        user_query: trimmed,
      });
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const errMsg = status === 429
        ? "You've used all 3 of your free AlphaBot queries for today. Come back tomorrow!"
        : 'Error fetching response.';
      setChatMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: errMsg, isStreaming: false };
        }
        return updated;
      });
    } finally {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  useEffect(() => {
    void fetchAlphaBotInDepthAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

    return {
    // Summary
    summary: summaryStream.streamingText || null,
    summaryIsLoading: summaryStream.isLoading,
    summaryIsStreaming: summaryStream.isStreaming,
    summaryToolsRunning: summaryStream.toolsRunning,
    summaryToolMessage: summaryStream.toolMessage,
    // Chat
    showChat,
    setShowChat,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading: chatStream.isLoading,
    chatIsStreaming: chatStream.isStreaming,
    chatToolsRunning: chatStream.toolsRunning,
    chatToolMessage: chatStream.toolMessage,
    chatEndRef,
    sendChat,
  };
};
