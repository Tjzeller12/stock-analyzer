import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MainPage from '../MainPage';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue([]),
  // The onboarding soft-gate calls authGet on mount; resolve as "completed"
  // so MainPage renders without redirecting.
  authGet: vi.fn().mockResolvedValue({ onboarding_completed: true }),
}));
vi.mock('ag-grid-react', () => ({ AgGridReact: () => <div data-testid="stock-grid" /> }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const renderMain = () =>
  render(<MemoryRouter><MainPage /></MemoryRouter>);

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header and main card titles', async () => {
    await act(async () => { renderMain(); });
    expect(screen.getByText(/AlphaBot Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/My Stocks/i)).toBeInTheDocument();
    // 'News' appears in both the card title and the filter dropdown, use getAllByText
    expect(screen.getAllByText(/News/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Comparison Analysis/i)).toBeInTheDocument();
  });

  it('renders the stock table grid component', async () => {
    await act(async () => { renderMain(); });
    expect(screen.getByTestId('stock-grid')).toBeInTheDocument();
  });

  it('does not render the radar graph panel when no compare data is loaded', async () => {
    await act(async () => { renderMain(); });
    // CompareRadarScores starts null, so the graph should not render
    expect(screen.queryByText(/Compare Radar Graph/i)).toBeInTheDocument(); // Card title renders
    // The radar chart (recharts canvas) should not be rendered when compareRadarScores is null
    expect(screen.queryByTestId('radar-chart')).not.toBeInTheDocument();
  });
});
