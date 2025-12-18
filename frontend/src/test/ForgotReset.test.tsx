import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const mockPost = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    post: mockPost,
  },
}));

describe('Forgot and Reset Password pages', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('submits forgot password request and shows success', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Sent' } });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com or \+2519/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/auth/password-reset/request', {
      identifier: 'user@example.com',
    });
    expect(await screen.findByText(/sent/i)).toBeInTheDocument();
  });

  it('submits reset code and updates password', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Password updated' } });

    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/paste code/i), { target: { value: 'token123' } });
    fireEvent.change(screen.getByPlaceholderText(/new password/i), {
      target: { value: 'newPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/auth/password-reset/confirm', {
      token: 'token123',
      password: 'newPass123',
    });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});
