import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TrpcProvider } from "../TrpcProvider";

/**
 * TD-102 — `mutations.retry: 0` regression net.
 *
 * Auto-retried mutations on a flaky-network request that reached the server
 * but lost its response can silently double-write. Test asserts the provider
 * mounts with the explicit zero-retry mutation default. Renders into JSDOM
 * but only inspects the QueryClient surface — no network is touched.
 */

describe("<TrpcProvider />", () => {
  it("renders children inside the provider tree", () => {
    const { getByText } = render(
      <TrpcProvider>
        <span>child</span>
      </TrpcProvider>,
    );
    expect(getByText("child")).toBeInTheDocument();
  });

  it("declares mutations.retry: 0 in the provider source (regression net)", async () => {
    // Source-text guard — guards against a future hand edit that drops the
    // mutation-retry-zero guard. Imported via a relative URL so this works
    // in the ESM browser-test runtime (no __dirname).
    const url = new URL("../TrpcProvider.tsx", import.meta.url);
    const file = await fetch(url.toString()).then((r) => r.text());
    expect(file).toMatch(/mutations:\s*\{[\s\n]*retry:\s*0/);
  });
});
