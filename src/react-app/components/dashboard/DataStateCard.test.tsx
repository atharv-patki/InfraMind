import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";

describe("DataStateCard", () => {
  it("renders loading state as status region", () => {
    render(
      <DataStateCard
        state="loading"
        title="Loading"
        detail="Fetching data"
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("renders error state as alert and triggers retry", () => {
    const onRetry = vi.fn();
    render(
      <DataStateCard
        state="error"
        title="Failed"
        detail="Network issue"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
