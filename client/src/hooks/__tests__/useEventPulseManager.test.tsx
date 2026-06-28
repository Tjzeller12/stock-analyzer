import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEventPulseManager } from '../useEventPulseManager';
import { ALPHA_BOT_ENDPOINTS } from '../../constants/api';
import React from 'react';

const mockStart = vi.fn();
const mockReset = vi.fn();

vi.mock('../useAlphaBotStream', () => ({
  useAlphaBotStream: vi.fn(() => ({
    streamingText: '',
    isLoading: false,
    isStreaming: false,
    toolsRunning: 0,
    toolMessage: '',
    error: null,
    start: mockStart,
    reset: mockReset,
    getFullText: vi.fn(() => ''),
  })),
}));

describe('useEventPulseManager', () => {
  const mockRef = { current: document.createElement('div') } as React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes cleanly in an idle phase context', () => {
    const { result } = renderHook(() => useEventPulseManager('TSLA', mockRef));
    expect(result.current.selectionPhase).toBe('idle');
    expect(result.current.anchorStart).toBeNull();
    expect(result.current.analysisResult).toBeNull();
  });

  it('transitions properly into selecting and clears pulse constraints successfully', () => {
    const { result } = renderHook(() => useEventPulseManager('TSLA', mockRef));

    act(() => {
      result.current.setSelectionPhase('selecting');
      result.current.setAnchorStart({ time: 100, price: 50, rawDateStr: '' });
    });

    expect(result.current.selectionPhase).toBe('selecting');
    expect(result.current.anchorStart?.price).toBe(50);

    act(() => {
      result.current.clearPulse();
    });

    expect(result.current.selectionPhase).toBe('idle');
    expect(result.current.anchorStart).toBeNull();
  });

  it('calls stream.start with the event-pulse stream endpoint when both valid anchors are selected', async () => {
    const { result } = renderHook(() => useEventPulseManager('TSLA', mockRef));

    await act(async () => {
      result.current.setAnchorStart({ time: 100, price: 50, rawDateStr: '2022-01-01' });
      result.current.setAnchorEnd({ time: 200, price: 150, rawDateStr: '2022-02-01' });
      result.current.setSelectionPhase('selected');
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockStart).toHaveBeenCalledWith(
      ALPHA_BOT_ENDPOINTS.EVENT_PULSE_STREAM,
      expect.objectContaining({
        stock_symbol: 'TSLA',
        start_date_str: '2022-01-01',
        date_str: '2022-02-01',
        swing_type: 'Massive Rally', // 150 > 50
      }),
    );
  });
});
