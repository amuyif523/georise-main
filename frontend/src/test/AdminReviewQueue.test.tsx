import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewQueuePage from "../pages/admin/ReviewQueuePage";

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/api", () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock("../layouts/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Admin review queue", () => {
  beforeEach(() => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        incidents: [
          {
            id: 12,
            title: "Test incident",
            category: "FIRE",
            status: "RECEIVED",
            reviewStatus: "PENDING_REVIEW",
            createdAt: new Date().toISOString(),
            reporter: { id: 1, fullName: "Test Citizen", trustScore: 2 },
          },
        ],
      },
    });
    apiPostMock.mockReset().mockResolvedValue({});
  });

  it("loads incidents and approves one", async () => {
    const user = userEvent.setup();
    render(<ReviewQueuePage />);

    expect(await screen.findByText("Test incident")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(apiPostMock).toHaveBeenCalledWith("/incidents/12/review", { decision: "APPROVE" });
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });
  });
});
