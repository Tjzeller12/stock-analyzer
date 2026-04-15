import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EventPulseChart from '../EventPulseChart';
import { ThemeContext } from '../../../ThemeContext';

// Stub out lightweight-charts canvas renderer
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addSeries: vi.fn().mockReturnValue({ setData: vi.fn() }),
    timeScale: vi.fn().mockReturnValue({
      fitContent: vi.fn(),
      subscribeVisibleTimeRangeChange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      subscribeSizeChange: vi.fn(),
    }),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  AreaSeries: 'AreaSeries',
}));

describe('EventPulseChart Integration Wrapper', () => {
  it('renders gracefully ignoring heavy native canvas bounding constraints', () => {
    // Stub out the ResizeObserver bound globally internally within the component
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>
        <EventPulseChart 
          symbol="AAPL" 
          data={[]} 
          activeTimeFrame="1W" 
          onTimeFrameChange={() => {}} 
        />
      </ThemeContext.Provider>
    );
    
    // Test native DOM constraints render despite mocked lightweight-charts
    expect(screen.getByText(/AAPL/i)).toBeInTheDocument();
    expect(screen.getByText(/Intraday charts are currently un-analyzable due to market noise./i)).toBeInTheDocument();
  });
});
