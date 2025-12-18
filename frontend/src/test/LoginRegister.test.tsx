import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';

const apiPostMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
const setAuthMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  default: {
    post: apiPostMock,
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
    setAuth: setAuthMock,
    user: null,
  }),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher" />,
}));

describe('Login/Register flows', () => {
  beforeEach(() => {
    apiPostMock.mockReset().mockResolvedValue({});
    loginMock.mockReset().mockResolvedValue({});
    setAuthMock.mockReset();
  });

  it('submits login with default credentials', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /login/i }));
    expect(loginMock).toHaveBeenCalledWith('citizen@example.com', 'password123');
  });

  it('submits registration payload', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'test.user@example.com');
    await user.type(screen.getByLabelText(/phone/i), '+251911000111');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    const form = screen.getByTestId('register-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(apiPostMock).toHaveBeenCalled());
    expect(apiPostMock).toHaveBeenCalledWith('/auth/register', {
      fullName: 'Test User',
      email: 'test.user@example.com',
      password: 'password123',
      phone: '+251911000111',
      role: 'CITIZEN',
    });
  });
});
