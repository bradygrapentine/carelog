import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeSwitcher, applyPalette } from "../ThemeSwitcher";

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

  it("renders a single light/dark toggle button", () => {
    render(<ThemeSwitcher />);
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toBeInTheDocument();
  });

  it("dark toggle adds .dark class and persists", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("toggling dark twice returns to light", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("does not render a palette picker", () => {
    render(<ThemeSwitcher />);
    expect(screen.queryByRole("button", { name: /hearth/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sage parlor/i })).toBeNull();
  });

  it("applyPalette is a no-op (backward compat export still exists)", () => {
    // Should not throw
    expect(() => applyPalette("sage")).not.toThrow();
  });

  it("survives a localStorage quota error without throwing", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    setItem.mockRestore();
  });
});
