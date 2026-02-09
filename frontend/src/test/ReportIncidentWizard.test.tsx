import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportIncidentWizard from '../pages/ReportIncidentWizard';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('../context/SystemContext', () => ({
  useSystem: () => ({ crisisMode: false }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Test User' },
  }),
}));

describe('ReportIncidentWizard', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  // Mock LocationStep to avoid Leaflet issues
  vi.mock('../features/reporting/steps/LocationStep', () => ({
    LocationStep: ({ onNext }: { onNext: () => void }) => (
      <div>
        <button onClick={onNext}>Confirm Location</button>
      </div>
    ),
  }));

  it('validates required fields in Details step', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportIncidentWizard />
      </MemoryRouter>,
    );

    // Step 1: Category
    await user.click(screen.getByRole('button', { name: /fire emergency/i }));

    // Step 2: Location (Mocked)
    await user.click(await screen.findByRole('button', { name: /confirm location/i }));

    // Step 3: Details - Attempt to continue without filling fields
    const reviewButtons1 = await screen.findAllByRole('button', { name: /review/i });
    await user.click(reviewButtons1[0]);

    expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
  });

  it('advances to review step when details are provided', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportIncidentWizard />
      </MemoryRouter>,
    );

    // Step 1: Category
    await user.click(screen.getByRole('button', { name: /fire emergency/i }));

    // Step 2: Location (Mocked)
    await user.click(await screen.findByRole('button', { name: /confirm location/i }));

    // Step 3: Details
    const [titleInput, descriptionInput] = await screen.findAllByRole('textbox');
    await user.type(titleInput, 'Fire report');
    await user.type(descriptionInput, 'Smoke seen nearby.');

    const reviewButtons2 = await screen.findAllByRole('button', { name: /review/i });
    await user.click(reviewButtons2[0]);

    // Step 4: Review
    expect(await screen.findByText(/confirm transmission/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
