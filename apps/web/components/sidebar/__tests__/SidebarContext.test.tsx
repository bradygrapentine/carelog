import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useContext } from "react";
import { SidebarContext, SidebarProvider } from "../SidebarContext";

const replace = vi.fn();
let searchString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/journal/abc",
  useSearchParams: () => new URLSearchParams(searchString),
}));

function Consumer() {
  const { activeDestination, setActiveDestination } =
    useContext(SidebarContext);
  return (
    <div>
      <span data-testid="dest">{activeDestination}</span>
      <button onClick={() => setActiveDestination("medications")}>
        go meds
      </button>
    </div>
  );
}

describe("SidebarContext", () => {
  beforeEach(() => {
    replace.mockClear();
    searchString = "";
  });

  it('reads the URL "?panel=" param as the source of truth', () => {
    searchString = "panel=team";
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("dest")).toHaveTextContent("team");
  });

  it('falls back to "journal" when no panel param is set', () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("dest")).toHaveTextContent("journal");
  });

  it("writes to the URL via router.replace when setActiveDestination is called", () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("go meds"));
    expect(replace).toHaveBeenCalledWith(
      "/journal/abc?panel=medications",
      expect.objectContaining({ scroll: false }),
    );
  });
});
