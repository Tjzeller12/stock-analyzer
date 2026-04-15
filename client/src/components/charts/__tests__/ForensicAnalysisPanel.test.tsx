import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ForensicAnalysisPanel from '../ForensicAnalysisPanel';

describe('ForensicAnalysisPanel pure layout element wrapper', () => {
  it('returns exactly null if phase is explicitly NOT deeply formally selected', () => {
    const { container } = render(
      <ForensicAnalysisPanel 
        selectionPhase="selecting" 
        anchorStart={{ time: 0, price: 10, rawDateStr: '' }} 
        anchorEnd={null} 
        isAnalyzing={false} 
        analysisResult={null} 
        clearPulse={() => {}} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders structurally dynamically positive components when cleanly formatted to evaluate momentum explicitly', () => {
    const clearMock = vi.fn();
    render(
      <ForensicAnalysisPanel 
        selectionPhase="selected" 
        anchorStart={{ time: 0, price: 100, rawDateStr: '' }} 
        anchorEnd={{ time: 100, price: 150, rawDateStr: '' }} 
        isAnalyzing={false} 
        analysisResult="Test Results!" 
        clearPulse={clearMock} 
      />
    );
    // 150 / 100 = 50%
    expect(screen.getByText(/Test Results!/i)).toBeInTheDocument();
    expect(screen.getByText(/50.0% Rally/i)).toBeInTheDocument();
  });
});
