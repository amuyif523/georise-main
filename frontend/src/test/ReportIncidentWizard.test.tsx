import React from 'react';
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

describe('ReportIncidentWizard', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it('validates required fields before continuing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportIncidentWizard />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /continue to location/i }));
    expect(screen.getByText(/please provide a title and description/i)).toBeInTheDocument();
  });

  it('advances to location step when description is present', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportIncidentWizard />
      </MemoryRouter>,
    );

    const [titleInput, descriptionInput] = screen.getAllByRole('textbox');
    await user.type(titleInput, 'Fire report');
    await user.type(descriptionInput, 'Smoke seen nearby.');
    await user.click(screen.getByRole('button', { name: /continue to location/i }));

    expect(screen.getByText('incident.location')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });
});
