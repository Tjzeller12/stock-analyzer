import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTER_FUTURE } from '../../constants/router';
import DiscoveryPage from '../DiscoveryPage';

// Stub the Header (not under test; pulls in theme context + assets).
vi.mock('../../components/common/Header', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

// Controllable hook state, mutated per test before render.
const hookState: any = {
  recommendations: [],
  refinements: [],
  loading: false,
  error: null,
  hasProfile: true,
  hasGenerated: false,
  generate: vi.fn(),
  refine: vi.fn(),
  removeRefinement: vi.fn(),
  clearRefinements: vi.fn(),
  goToStock: vi.fn(),
  addToPortfolio: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../hooks/useDiscoveryManager', () => ({
  MAX_REFINEMENTS: 8,
  useDiscoveryManager: () => hookState,
}));

const renderPage = () =>
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <DiscoveryPage />
    </MemoryRouter>
  );

describe('DiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(hookState, {
      recommendations: [],
      refinements: [],
      loading: false,
      error: null,
      hasProfile: true,
      hasGenerated: false,
    });
  });

  it('calls generate() on mount', () => {
    renderPage();
    expect(hookState.generate).toHaveBeenCalledTimes(1);
  });

  it('renders recommendation cards when present', () => {
    hookState.recommendations = [
      { ticker: 'MSFT', company_name: 'Microsoft', rationale: 'Moat.', sector: 'Technology' },
      { ticker: 'AAPL', company_name: 'Apple', rationale: 'Cash.', sector: 'Technology' },
    ];
    hookState.hasGenerated = true;
    renderPage();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows empty state when a run returns nothing', () => {
    hookState.hasGenerated = true;
    hookState.recommendations = [];
    renderPage();
    expect(screen.getByText(/No recommendations/i)).toBeInTheDocument();
  });

  it('shows the complete-profile CTA when there is no profile', () => {
    hookState.hasGenerated = true;
    hookState.hasProfile = false;
    renderPage();
    expect(screen.getByRole('button', { name: /Complete your profile/i })).toBeInTheDocument();
  });

  it('add button on a card calls addToPortfolio (shared add path)', () => {
    hookState.recommendations = [
      { ticker: 'NVDA', company_name: 'Nvidia', rationale: 'AI.', sector: 'Technology' },
    ];
    hookState.hasGenerated = true;
    renderPage();
    fireEvent.click(screen.getByLabelText(/Add NVDA to your list/i));
    expect(hookState.addToPortfolio).toHaveBeenCalledWith('NVDA');
  });
});
