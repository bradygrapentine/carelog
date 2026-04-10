import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useContext } from "react";
import { SidebarContext, SidebarProvider } from "../SidebarContext";

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
  it('provides "journal" as default destination', () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("dest")).toHaveTextContent("journal");
  });

  it("updates activeDestination when setActiveDestination is called", () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("go meds"));
    expect(screen.getByTestId("dest")).toHaveTextContent("medications");
  });
});
