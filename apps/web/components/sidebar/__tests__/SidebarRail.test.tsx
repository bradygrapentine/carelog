import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "../SidebarContext";
import { SidebarRail } from "../SidebarRail";

describe("SidebarRail", () => {
  it("renders with sidebar-rail testid", () => {
    render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-rail")).toBeInTheDocument();
  });

  it("is hidden on mobile and visible on md+", () => {
    render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    );
    const rail = screen.getByTestId("sidebar-rail");
    expect(rail.className).toMatch(/hidden/);
    expect(rail.className).toMatch(/md:flex/);
  });
});
