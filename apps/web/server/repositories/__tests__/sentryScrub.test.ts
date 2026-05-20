import { describe, it, expect, vi } from "vitest";

// Importing sentry.server.config runs Sentry.init() as a module side effect.
// Mock the SDK so init is a no-op (no DSN wiring, no OTel) — we only exercise
// the exported pure scrubber.
vi.mock("@sentry/nextjs", () => ({ init: vi.fn() }));

import { scrubSentryEvent, scrubCausePhi } from "../../../sentry.server.config";

// TD-192 part (c): repository throws carry the raw Postgres error on `.cause`,
// whose `detail`/`message` can echo column values (PHI). The Sentry beforeSend
// hook must ensure no such fragment survives into the captured event payload.
describe("TD-192 — Sentry cause PHI scrub (sentinel)", () => {
  const PHI = "jane@x.com";

  it("removes cause.detail and redacts cause.message anywhere in the event", () => {
    const event = {
      exception: {
        values: [{ type: "Error", value: "identity_update_failed" }],
      },
      contexts: {
        // Simulate a serializer that walked the Error's `cause` into the event.
        error: {
          cause: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "x" DETAIL: Key (email)=(jane@x.com).',
            detail: `Key (email)=(${PHI})`,
          },
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);
    const serialized = JSON.stringify(scrubbed);

    // The PHI fragment must not survive serialization.
    expect(serialized).not.toContain(PHI);
    expect(serialized).not.toContain("duplicate key");
    // Structural signal is preserved.
    expect(scrubbed.contexts.error.cause).toMatchObject({ code: "23505" });
    expect(
      (scrubbed.contexts.error.cause as { detail?: unknown }).detail,
    ).toBeUndefined();
    expect(
      (scrubbed.contexts.error.cause as { message?: unknown }).message,
    ).toBe("[redacted]");
    // The stable top-level code is untouched.
    expect(scrubbed.exception.values[0].value).toBe("identity_update_failed");
  });

  it("handles nested causes and is cycle-safe", () => {
    const inner: Record<string, unknown> = {
      message: `inner ${PHI}`,
      detail: PHI,
    };
    const outer: Record<string, unknown> = {
      cause: { message: `outer ${PHI}`, detail: PHI, cause: inner },
    };
    // Introduce a cycle to prove the WeakSet guard prevents infinite recursion.
    inner.self = inner;

    const scrubbed = scrubCausePhi({ contexts: { error: outer } });
    expect(JSON.stringify(scrubbed, cycleSafe())).not.toContain(PHI);
  });
});

// JSON.stringify replacer that drops circular refs so the assertion can run.
function cycleSafe() {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown) => {
    if (value !== null && typeof value === "object") {
      if (seen.has(value as object)) return undefined;
      seen.add(value as object);
    }
    return value;
  };
}
