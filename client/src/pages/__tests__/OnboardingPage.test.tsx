import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HORIZON_OPTIONS, QUESTIONNAIRE } from '../../constants/onboarding';
import OnboardingPage from '../OnboardingPage';
import { authPut } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  authPut: vi.fn(),
}));
vi.mock('../../resources/alphaBotLogo.png', () => ({ default: 'logo.png' }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>
  );

const clickContinue = () =>
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the welcome step first', () => {
    renderPage();
    expect(screen.getByText(/tailor AlphaBot to you/i)).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('disables Continue on an unanswered question step', () => {
    renderPage();
    clickContinue(); // welcome -> first question
    expect(screen.getByText(QUESTIONNAIRE[0].prompt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('skip path sets the dismissal flag and navigates to /main (P4)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(sessionStorage.getItem('alphabot.onboarding.dismissed')).toBe('1');
    expect(mockNavigate).toHaveBeenCalledWith('/main');
  });

  it('completes the flow, submits, and navigates to /main', async () => {
    (authPut as any).mockResolvedValueOnce({ onboarding_completed: true });
    renderPage();

    clickContinue(); // welcome -> Q1

    // Answer every scenario question with its first option.
    for (const question of QUESTIONNAIRE) {
      fireEvent.click(screen.getByText(question.options[0].label));
      clickContinue();
    }

    // Time horizon step
    fireEvent.click(screen.getByText(HORIZON_OPTIONS[3].label)); // 10+ years
    clickContinue();

    // Budget step — enter an amount
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } });
    clickContinue();

    // Sector step (optional) -> Review
    clickContinue();

    // Review step shows derived tags + a Finish button
    const finishBtn = await screen.findByRole('button', { name: /finish/i });
    await act(async () => {
      fireEvent.click(finishBtn);
    });

    await waitFor(() => {
      expect(authPut).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/main');
      expect(sessionStorage.getItem('alphabot.onboarding.dismissed')).toBe('1');
    });
  });
});
