import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCOVERY_ENDPOINTS, PORTFOLIO_ENDPOINTS } from '../../constants/api';
import { ROUTER_FUTURE } from '../../constants/router';
import PrivateRoute from '../../components/PrivateRoute';
import { authPost } from '../../utils/api';
import DiscoveryPage, { DiscoverySession } from '../DiscoveryPage';

// Stub the Header (not under test; pulls in theme context + assets).
vi.mock('../../components/common/Header', () => ({
  default: ({ title }: { title: string }) => <div>{title}<Link to="/main">Main</Link></div>,
}));

vi.mock('../../utils/api', () => ({ authPost: vi.fn() }));
const post = vi.mocked(authPost);

const recommendations = [
  { ticker: 'MSFT', company_name: 'Microsoft', rationale: 'Moat.', sector: 'Technology' },
  { ticker: 'AAPL', company_name: 'Apple', rationale: 'Cash.', sector: 'Technology' },
];

const renderPage = () =>
  render(
    <MemoryRouter future={ROUTER_FUTURE} initialEntries={['/discovery']}>
      <Routes>
        <Route element={<PrivateRoute><DiscoverySession /></PrivateRoute>}>
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/main" element={<Link to="/discovery">Discover</Link>} />
        </Route>
        <Route path="/login" element={<div>Sign in</div>} />
      </Routes>
    </MemoryRouter>
  );

const searchButton = () => screen.getByRole('button', { name: 'Search' });
const addFilter = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Search instructions (optional)' }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
};

describe('DiscoveryPage', () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.setItem('token', 'test-session');
  });

  it('restores results and filters after leaving Discover without searching again', async () => {
    post.mockResolvedValueOnce({ recommendations }).mockResolvedValueOnce({ recommendations: [] });
    renderPage();
    addFilter('Include utilities');
    fireEvent.click(searchButton());
    await screen.findByText('MSFT');

    fireEvent.click(screen.getByRole('link', { name: 'Main' }));
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Discover' }));

    expect(screen.getByText('MSFT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove refinement: Include utilities' }));
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);

    fireEvent.click(searchButton());
    await screen.findByText(/No recommendations/i);
    expect(post).toHaveBeenLastCalledWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: [] });
  });

  it('redirects on protected navigation after the session ends', () => {
    renderPage();
    localStorage.removeItem('token');
    fireEvent.click(screen.getByRole('link', { name: 'Main' }));

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('waits for Search while the user edits filters', async () => {
    post.mockResolvedValueOnce({ recommendations, generated_from: { has_profile: true } });
    renderPage();
    expect(searchButton()).toBeEnabled();
    expect(post).not.toHaveBeenCalled();

    addFilter('Exclude EV companies');
    addFilter('Prefer dividends');
    fireEvent.click(screen.getByRole('button', { name: 'Remove refinement: Exclude EV companies' }));
    expect(screen.queryByText('Exclude EV companies')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByText('Prefer dividends')).not.toBeInTheDocument();
    addFilter('Include utilities');
    expect(screen.getByText('Include utilities')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(searchButton());
    expect(await screen.findByText('MSFT')).toBeInTheDocument();
    expect(post).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: ['Include utilities'],
    });

    addFilter('Prefer dividends');
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Search to apply your filters.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('searches with the optional instructions when Enter is pressed', async () => {
    post.mockResolvedValueOnce({ recommendations, generated_from: { has_profile: true } });
    renderPage();
    const field = screen.getByRole('textbox', { name: 'Search instructions (optional)' });
    userEvent.type(field, 'Prefer dividends{enter}');

    expect(await screen.findByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(post).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, {
      refinements: ['Prefer dividends'],
    });
  });

  it('shows empty state when a run returns nothing', async () => {
    post.mockResolvedValueOnce({ recommendations: [], generated_from: { has_profile: true } });
    renderPage();
    fireEvent.click(searchButton());

    expect(await screen.findByText(/No recommendations/i)).toBeInTheDocument();
    expect(post).toHaveBeenCalledExactlyOnceWith(DISCOVERY_ENDPOINTS.GENERATE, { refinements: [] });
  });

  it('shows the request error and offers another search', async () => {
    post.mockResolvedValueOnce({ recommendations: [] }).mockRejectedValueOnce(new Error('Failed search'));
    renderPage();
    fireEvent.click(searchButton());
    await screen.findByText(/No recommendations/i);
    fireEvent.click(searchButton());

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't generate recommendations");
    expect(screen.queryByText(/No recommendations/i)).not.toBeInTheDocument();
    expect(searchButton()).toBeEnabled();
  });

  it('shows the complete-profile CTA when there is no profile', async () => {
    post.mockResolvedValueOnce({ recommendations, generated_from: { has_profile: false } });
    renderPage();
    fireEvent.click(searchButton());

    expect(await screen.findByRole('button', { name: /Complete your profile/i })).toBeInTheDocument();
  });

  it('add button on a card uses the shared portfolio add path', async () => {
    post.mockResolvedValueOnce({ recommendations, generated_from: { has_profile: true } });
    renderPage();
    fireEvent.click(searchButton());
    fireEvent.click(await screen.findByLabelText(/Add MSFT to your list/i));

    expect(post).toHaveBeenLastCalledWith(PORTFOLIO_ENDPOINTS.ADD, { symbol: 'MSFT' });
    expect(await screen.findByLabelText('MSFT added to your list')).toBeInTheDocument();
  });
});
