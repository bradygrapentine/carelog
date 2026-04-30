import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeSwitcher, applyPalette } from "../ThemeSwitcher";

const PALETTE_KEY = "carelog-palette";
const THEME_KEY = "carelog-theme";

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });
  afterEach(() => cleanup());

  it("defaults to hearth and no data-theme attribute", () => {
    render(<ThemeSwitcher />);
    expect(
      screen.getByRole("button", { name: /hearth palette/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("switching to sage sets data-theme and persists to localStorage", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /sage parlor/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("sage");
    expect(localStorage.getItem(PALETTE_KEY)).toBe("sage");
  });

  it("switching back to hearth removes the data-theme attribute", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /sage parlor/i }));
    fireEvent.click(screen.getByRole("button", { name: /hearth palette/i }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(PALETTE_KEY)).toBe("hearth");
  });

  it("dark toggle adds .dark class and persists", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("hydrates from existing localStorage palette", () => {
    localStorage.setItem(PALETTE_KEY, "sage");
    render(<ThemeSwitcher />);
    expect(
      screen.getByRole("button", { name: /sage parlor/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("applyPalette helper toggles the data-theme attribute", () => {
    applyPalette("sage");
    expect(document.documentElement.getAttribute("data-theme")).toBe("sage");
    applyPalette("hearth");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("survives a localStorage quota error without throwing", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /sage parlor/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("sage");
    setItem.mockRestore();
  });
});
