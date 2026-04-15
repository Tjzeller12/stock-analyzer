import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEventPulseManager } from '../useEventPulseManager';
import React from 'react';
import { authPost } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  authPost: vi.fn(),
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

  it('dispatches the forensic analysis endpoint instantly when both valid anchors are dynamically selected', async () => {
    (authPost as any).mockResolvedValueOnce({ response: 'Swing Analysis Success!' });
    
    const { result } = renderHook(() => useEventPulseManager('TSLA', mockRef));
    
    // Simulate completing the boundary slice
    await act(async () => {
      result.current.setAnchorStart({ time: 100, price: 50, rawDateStr: '2022-01-01' });
      result.current.setAnchorEnd({ time: 200, price: 150, rawDateStr: '2022-02-01' });
      result.current.setSelectionPhase('selected');
    });
    
    // Wait for the internal async task to fire
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisResult).toBe('Swing Analysis Success!');
  });
});
