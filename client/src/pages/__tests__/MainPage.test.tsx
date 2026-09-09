import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTER_FUTURE } from '../../constants/router';
import MainPage from '../MainPage';

const compareState = {
  compareRadarScores: null as unknown,
  selectedSymbols: new Set<string>(),
  compareLoading: false,
  compareError: null as string | null,
  compareResult: null as { analysis: string; doughnutChartData: { labels: string[]; datasets: unknown[] } } | null,
  compareStocks: vi.fn(),
  toggleSelectSymbol: vi.fn(),
};

vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue([]),
  authGet: vi.fn().mockResolvedValue({ onboarding_completed: true }),
}));
vi.mock('ag-grid-react', () => ({ AgGridReact: () => <div data-testid="stock-grid" /> }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('../../hooks/useCompareAlphaBotManager', () => ({
  useCompareAlphaBotManager: () => compareState,
}));

const renderMain = () =>
  render(<MemoryRouter future={ROUTER_FUTURE}><MainPage /></MemoryRouter>);

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compareState.compareRadarScores = null;
    compareState.compareLoading = false;
    compareState.compareResult = null;
    compareState.compareError = null;
    compareState.selectedSymbols = new Set();
    localStorage.clear();
  });

  it('renders the header and main card titles', async () => {
    await act(async () => { renderMain(); });
    expect(screen.getByText(/AlphaBot Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getAllByText(/News/i).length).toBeGreaterThan(0);
  });

  it('renders the stock table grid component', async () => {
    await act(async () => { renderMain(); });
    expect(screen.getByTestId('stock-grid')).toBeInTheDocument();
  });

  it('does not render compare cards until a compare has started (P11)', async () => {
    await act(async () => { renderMain(); });
    expect(screen.queryByText(/Compare Radar Graph/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Portfolio Distribution Chart/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comparison Analysis/i)).not.toBeInTheDocument();
    expect(document.getElementById('compare-results')).toBeTruthy();
  });

  it('shows radar as soon as compare scores exist, before analysis (P14)', async () => {
    compareState.compareRadarScores = {
      labels: ['Valuation'],
      datasets: [{ label: 'AAPL', data: [80] }],
    };
    await act(async () => { renderMain(); });
    expect(screen.getByText(/Compare Radar Graph/i)).toBeInTheDocument();
    expect(screen.getByText(/Comparison Analysis/i)).toBeInTheDocument();
    expect(screen.queryByText(/Apple vs Tesla/i)).not.toBeInTheDocument();
  });

  it('scrolls to #compare-results when Compare is clicked (P12)', async () => {
    compareState.selectedSymbols = new Set(['AAPL', 'MSFT']);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await act(async () => { renderMain(); });
    fireEvent.click(screen.getByRole('button', { name: /compare selected/i }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(compareState.compareStocks).toHaveBeenCalled();
  });
});
