import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROUTER_FUTURE } from '../../constants/router';
import StockPage from '../StockPage';

// NOTE: vi.mock is hoisted to top of file by Vitest, so mock data must be
// inlined directly inside the factory — no external variables can be referenced.
vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 175.50,
    change: 1.25,
    change_percent: 0.72,
    volume: 65000000,
    market_cap: 2700000000000,
    news_sentiment_data: { feed: [] },
  }),
}));
vi.mock('../../resources/alphaBotLogo.png', () => ({ default: 'logo.png' }));

vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    remove: vi.fn(),
    timeScale: () => ({
      fitContent: vi.fn(),
      subscribeVisibleTimeRangeChange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      subscribeSizeChange: vi.fn(),
    }),
    addSeries: vi.fn().mockReturnValue({ setData: vi.fn() }),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    applyOptions: vi.fn(),
  }),
  AreaSeries: 'AreaSeries',
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ symbol: 'AAPL' }),
    useLocation: () => ({ state: null }),
  };
});

const renderStockPage = () => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  return render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/stock/AAPL']}><StockPage /></MemoryRouter>);
};

describe('StockPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Radar Score panel and AlphaBot Analysis section', async () => {
    await act(async () => { renderStockPage(); });
    expect(screen.getByText(/Radar Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Alpha Bot Analysis/i)).toBeInTheDocument();
  });

  it('shows "Open Chat" toggle button by default and switches to View Analysis on click', async () => {
    await act(async () => { renderStockPage(); });
    const chatToggleBtn = screen.getByRole('button', { name: /open chat/i });
    expect(chatToggleBtn).toBeInTheDocument();

    await act(async () => { fireEvent.click(chatToggleBtn); });

    expect(screen.getByRole('button', { name: /view analysis/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about AAPL/i)).toBeInTheDocument();
  });

  it('shows the chat input placeholder for the correct symbol when chat is open', async () => {
    await act(async () => { renderStockPage(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /open chat/i })); });
    expect(screen.getByPlaceholderText(/Ask about AAPL/i)).toBeInTheDocument();
  });

  it('disables Send button when chat input is empty', async () => {
    await act(async () => { renderStockPage(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /open chat/i })); });
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables Send button when user types a message', async () => {
    await act(async () => { renderStockPage(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /open chat/i })); });
    const input = screen.getByPlaceholderText(/Ask about AAPL/i);
    await act(async () => { fireEvent.change(input, { target: { value: 'What is the P/E ratio?' } }); });
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });
});
