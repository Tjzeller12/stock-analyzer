import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROUTER_FUTURE } from '../../constants/router';
import Profile from '../Profile';
import axios from 'axios';

vi.mock('axios');

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const renderProfile = () =>
  render(<MemoryRouter future={ROUTER_FUTURE}><Profile /></MemoryRouter>);

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (axios.post as any).mockResolvedValue({
      data: { username: 'johndoe', email: 'john@example.com', longterm_investor: false }
    });
  });

  it('renders core profile form elements on load', async () => {
    await act(async () => { renderProfile(); });
    expect(screen.getByText(/Profile Settings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('fetches and populates user info correctly on mount', async () => {
    await act(async () => { renderProfile(); });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    const usernameInput = screen.getByDisplayValue('johndoe');
    expect(usernameInput).toBeInTheDocument();

    const emailInput = screen.getByDisplayValue('john@example.com');
    expect(emailInput).toBeInTheDocument();
  });

  it('toggles the password reset panel when Reset Password is clicked', async () => {
    await act(async () => { renderProfile(); });

    const resetBtn = screen.getByRole('button', { name: /reset password/i });
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();

    await act(async () => { resetBtn.click(); });

    expect(screen.getByText(/Submit New Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel reset password/i })).toBeInTheDocument();
  });
});
