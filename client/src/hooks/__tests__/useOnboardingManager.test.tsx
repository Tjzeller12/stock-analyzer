import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUESTIONNAIRE, computeRiskScore, riskTagFor } from '../../constants/onboarding';
import { useOnboardingManager } from '../useOnboardingManager';
import { authPut } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  authPut: vi.fn(),
}));

const DRAFT_KEY = 'alphabot.onboarding.draft.v1';

describe('useOnboardingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with an empty draft on the welcome step', () => {
    const { result } = renderHook(() => useOnboardingManager());
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.currentStep.kind).toBe('welcome');
    expect(result.current.draft.answers).toEqual({});
  });

  it('persists the draft to localStorage and restores it on remount (P3)', async () => {
    const { result, unmount } = renderHook(() => useOnboardingManager());

    act(() => {
      result.current.answerQuestion('q_market_crash', 'buy_more');
      result.current.setBudget(2500);
    });

    // Wait past the debounce window.
    await new Promise((r) => setTimeout(r, 350));
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    expect(stored.answers.q_market_crash).toBe('buy_more');
    expect(stored.budget).toBe(2500);

    unmount();

    const { result: restored } = renderHook(() => useOnboardingManager());
    expect(restored.current.draft.answers.q_market_crash).toBe('buy_more');
    expect(restored.current.draft.budget).toBe(2500);
  });

  it('toggles sectors on and off without an artificial cap', () => {
    const { result } = renderHook(() => useOnboardingManager());
    act(() => {
      result.current.toggleSector('TECHNOLOGY');
      result.current.toggleSector('FINANCE');
      result.current.toggleSector('LIFE SCIENCES');
      result.current.toggleSector('MANUFACTURING');
    });
    expect(result.current.draft.selectedSectors).toEqual([
      'TECHNOLOGY',
      'FINANCE',
      'LIFE SCIENCES',
      'MANUFACTURING',
    ]);

    act(() => {
      result.current.toggleSector('FINANCE'); // toggling an existing one off
    });
    expect(result.current.draft.selectedSectors).toEqual([
      'TECHNOLOGY',
      'LIFE SCIENCES',
      'MANUFACTURING',
    ]);
  });

  it('preview matches the shared scoring mapping (P2)', () => {
    const { result } = renderHook(() => useOnboardingManager());
    act(() => {
      for (const q of QUESTIONNAIRE) {
        result.current.answerQuestion(q.id, q.options[0].id); // most aggressive
      }
      result.current.setTimeHorizon(12);
    });
    const preview = result.current.previewProfile();
    const expectedScore = computeRiskScore(result.current.draft.answers);
    expect(preview.risk_tolerance_score).toBe(expectedScore);
    expect(preview.risk_tag).toBe(riskTagFor(expectedScore));
    expect(preview.horizon_tag).toBe('Very Long');
  });

  it('guards navigation: cannot advance past an unanswered question', () => {
    const { result } = renderHook(() => useOnboardingManager());
    act(() => {
      result.current.next(); // welcome -> first question
    });
    expect(result.current.currentStep.kind).toBe('question');
    const beforeIndex = result.current.stepIndex;
    act(() => {
      result.current.next(); // blocked — question not answered
    });
    expect(result.current.stepIndex).toBe(beforeIndex);
    expect(result.current.canAdvance).toBe(false);
  });

  it('submit() posts the payload and clears the draft on success', async () => {
    (authPut as any).mockResolvedValueOnce({ onboarding_completed: true });
    const { result } = renderHook(() => useOnboardingManager());

    act(() => {
      result.current.answerQuestion('q_market_crash', 'buy_more');
      result.current.setTimeHorizon(7);
      result.current.setBudget(1000);
      result.current.toggleSector('TECHNOLOGY');
    });
    await new Promise((r) => setTimeout(r, 350));

    await act(async () => {
      await result.current.submit();
    });

    expect(authPut).toHaveBeenCalledTimes(1);
    const [, payload] = (authPut as any).mock.calls[0];
    expect(payload).toEqual({
      answers: { q_market_crash: 'buy_more' },
      time_horizon_years: 7,
      budget: 1000,
      preferred_sectors: ['TECHNOLOGY'],
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
