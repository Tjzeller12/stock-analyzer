import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import RegisterPage from '../RegisterPage';

vi.mock('axios');
vi.mock('../../resources/alphaBotLogo.png', () => ({ default: 'logo.png' }));
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => vi.fn(),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderRegister = () =>
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields and buttons correctly', () => {
    renderRegister();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
  });

  it('accepts user input in all three fields correctly', () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass123' } });

    expect(screen.getByLabelText(/email/i)).toHaveValue('test@test.com');
    expect(screen.getByLabelText(/username/i)).toHaveValue('newuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('pass123');
  });

  it('toggles password visibility on Show button interaction', () => {
    renderRegister();
    const passwordInput = screen.getByLabelText(/password/i);
    const showBtn = screen.getByRole('button', { name: /show/i });

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.mouseDown(showBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.mouseUp(showBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('submits registration and navigates to /onboarding on success', async () => {
    (axios.post as any).mockResolvedValueOnce({ data: { token: 'reg-token-xyz' } });
    renderRegister();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('reg-token-xyz');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('navigates back to /login when Back to Login is clicked', () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
