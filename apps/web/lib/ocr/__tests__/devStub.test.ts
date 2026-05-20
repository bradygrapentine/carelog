// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveOcrStub } from "../devStub";

const STUB = "Lisinopril 10mg\nTake once daily with water";

describe("resolveOcrStub (TD-203)", () => {
  it("returns null in production so no fabricated parse reaches a real upload", () => {
    expect(resolveOcrStub(STUB, "production")).toBeNull();
  });

  it("returns the stub fixture in development", () => {
    expect(resolveOcrStub(STUB, "development")).toBe(STUB);
  });

  it("returns the stub fixture under test", () => {
    expect(resolveOcrStub(STUB, "test")).toBe(STUB);
  });

  it("returns the stub when NODE_ENV is unset (local dev default)", () => {
    expect(resolveOcrStub(STUB, undefined)).toBe(STUB);
  });
});
