import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarProvider } from "../SidebarContext";
import { SidebarSheet } from "../SidebarSheet";

describe("SidebarSheet", () => {
  it('renders a trigger button with accessible name "Menu"', () => {
    render(
      <SidebarProvider>
        <SidebarSheet />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
  });

  it('opens the sheet and shows "CareSync" when the trigger is clicked', () => {
    render(
      <SidebarProvider>
        <SidebarSheet />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByText("CareSync")).toBeInTheDocument();
  });
});
