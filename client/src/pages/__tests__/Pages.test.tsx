import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ROUTER_FUTURE } from '../../constants/router';
import { ThemeContext } from '../../ThemeContext';

import LoginPage from '../LoginPage';
import RegisterPage from '../RegisterPage';
import MainPage from '../MainPage';
import Profile from '../Profile';
import StockPage from '../StockPage';

vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => vi.fn(),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Massive global mocking array overriding DOM limits structurally required natively
vi.mock('../../utils/api', () => ({
  authPost: vi.fn().mockResolvedValue([]),
  authGet: vi.fn().mockResolvedValue({}),
}));

// Mock heavy external node packages globally completely intercepting DOM crashes
vi.mock('ag-grid-react', () => ({ AgGridReact: () => <div data-testid="grid">Grid</div> }));
vi.mock('recharts', () => ({ Radar: () => <div/>, RadarChart: () => <div/>, PolarGrid: () => <div/>, PolarAngleAxis: () => <div/>, PolarRadiusAxis: () => <div/>, Tooltip: () => <div/> }));
vi.mock('lightweight-charts', () => ({ 
    createChart: () => ({ 
        remove: vi.fn(), 
        timeScale: () => ({ fitContent: vi.fn(), subscribeVisibleTimeRangeChange: vi.fn(), subscribeVisibleLogicalRangeChange: vi.fn(), subscribeSizeChange: vi.fn() }),
        addSeries: vi.fn().mockReturnValue({ setData: vi.fn() }),
        subscribeCrosshairMove: vi.fn(),
        subscribeClick: vi.fn()
    }),
    AreaSeries: 'AreaSeries'
}));

const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>
    {children}
  </ThemeContext.Provider>
);

describe('Top Level Page Route Wrappers', () => {
  it('renders strictly login bounds natively without completely crashing DOM', () => {
    render(<MemoryRouter future={ROUTER_FUTURE}><MockThemeProvider><LoginPage /></MockThemeProvider></MemoryRouter>);
    expect(screen.getByText(/Create an Account/i)).toBeInTheDocument();
  });

  it('renders strictly register bounds without crashing explicitly naturally', () => {
    render(<MemoryRouter future={ROUTER_FUTURE}><MockThemeProvider><RegisterPage /></MockThemeProvider></MemoryRouter>);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders primary app dashboard cleanly validating layout bounds precisely', () => {
    render(<MemoryRouter future={ROUTER_FUTURE}><MockThemeProvider><MainPage /></MockThemeProvider></MemoryRouter>);
    // Grid gets intercepted explicitly representing dashboard mount layout hooks cleanly
    expect(screen.getByTestId('grid')).toBeInTheDocument();
  });

  it('renders structural profile natively safely', () => {
    render(<MemoryRouter future={ROUTER_FUTURE}><MockThemeProvider><Profile /></MockThemeProvider></MemoryRouter>);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0); // Validating form load explicitly
  });

  it('mounts complex individual stock macro graph page heavily securely', () => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/stock/AAPL']}><MockThemeProvider><StockPage /></MockThemeProvider></MemoryRouter>);
    expect(screen.getByText(/Radar Score/i)).toBeInTheDocument();
  });
});
