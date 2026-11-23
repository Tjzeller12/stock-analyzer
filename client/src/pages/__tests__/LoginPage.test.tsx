import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ROUTER_FUTURE } from '../../constants/router';
import LoginPage from '../LoginPage';

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

const renderLogin = () =>
  render(<MemoryRouter future={ROUTER_FUTURE}><LoginPage /></MemoryRouter>);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all structural form elements correctly', () => {
    renderLogin();
    expect(screen.getByText('AlphaBot')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument();
  });

  it('updates username and password fields on user input', () => {
    renderLogin();
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('secret123');
  });

  it('toggles password visibility when Show/Hide button is held', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText(/password/i);
    const showButton = screen.getByRole('button', { name: /show/i });

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.mouseDown(showButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
    fireEvent.mouseUp(showButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('navigates to /main and saves token on successful login', async () => {
    (axios.post as any).mockResolvedValueOnce({ data: { token: 'abc123' } });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('abc123');
      expect(mockNavigate).toHaveBeenCalledWith('/main');
    });
  });

  it('navigates to /register when Create an Account is clicked', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });
});
