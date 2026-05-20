import { describe, it, expect } from "vitest";
import { z } from "zod";
import { initTRPC } from "@trpc/server";
import {
  walkRouter,
  diffSnapshots,
  formatDriftMessage,
} from "../schema-walker";

const t = initTRPC.create();
const proc = t.procedure;

function buildSynthetic() {
  return t.router({
    noInput: proc.query(() => "ok"),
    withInput: proc
      .input(z.object({ id: z.string().uuid() }))
      .query(() => ({ id: "1" })),
    create: proc
      .input(z.object({ name: z.string() }))
      .output(z.object({ id: z.string() }))
      .mutation(() => ({ id: "x" })),
    nested: t.router({
      inner: proc.input(z.object({ x: z.number() })).query(() => 1),
    }),
  });
}

describe("schema-walker", () => {
  it("walks every procedure into a stable dot-path map", () => {
    const snap = walkRouter(buildSynthetic());
    expect(Object.keys(snap).sort()).toEqual([
      "create",
      "nested.inner",
      "noInput",
      "withInput",
    ]);
  });

  it("captures query vs mutation type", () => {
    const snap = walkRouter(buildSynthetic());
    expect(snap.noInput.type).toBe("query");
    expect(snap.create.type).toBe("mutation");
  });

  it("emits null input for procedures with no input schema", () => {
    const snap = walkRouter(buildSynthetic());
    expect(snap.noInput.input).toBeNull();
  });

  it("converts Zod input/output to JSON Schema", () => {
    const snap = walkRouter(buildSynthetic());
    expect(snap.withInput.input).toMatchObject({
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
    });
    expect(snap.create.output).toMatchObject({
      type: "object",
      properties: { id: { type: "string" } },
    });
  });

  it("recurses into nested sub-routers", () => {
    const snap = walkRouter(buildSynthetic());
    expect(snap["nested.inner"]).toBeDefined();
    expect(snap["nested.inner"].type).toBe("query");
  });

  it("produces sorted keys for deterministic snapshots", () => {
    const snap = walkRouter(buildSynthetic());
    const keys = Object.keys(snap);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe("diffSnapshots + formatDriftMessage", () => {
  it("detects added, removed, and changed procedures", () => {
    const baseline = walkRouter(buildSynthetic());
    const drifted = t.router({
      noInput: proc.query(() => "ok"),
      withInput: proc
        .input(z.object({ id: z.string().uuid(), newField: z.string() })) // changed
        .query(() => ({ id: "1" })),
      // create removed
      nested: t.router({
        inner: proc.input(z.object({ x: z.number() })).query(() => 1),
      }),
      brandNew: proc.query(() => 0), // added
    });
    const current = walkRouter(drifted);
    const diff = diffSnapshots(baseline, current);
    expect(diff.added).toContain("brandNew");
    expect(diff.removed).toContain("create");
    expect(diff.changed).toContain("withInput");
  });

  it("drift message names the offending field path and hints API_VERSION bump", () => {
    const baseline = walkRouter(buildSynthetic());
    const drifted = t.router({
      noInput: proc.query(() => "ok"),
      withInput: proc
        .input(z.object({ id: z.string().uuid(), newField: z.string() }))
        .query(() => ({ id: "1" })),
      create: proc
        .input(z.object({ name: z.string() }))
        .output(z.object({ id: z.string() }))
        .mutation(() => ({ id: "x" })),
      nested: t.router({
        inner: proc.input(z.object({ x: z.number() })).query(() => 1),
      }),
    });
    const diff = diffSnapshots(baseline, walkRouter(drifted));
    const msg = formatDriftMessage(diff, "1.0.0");
    expect(msg).toContain("withInput");
    expect(msg).toContain("API_VERSION");
    expect(msg).toContain("UPDATE_SCHEMA_SNAPSHOT=1");
  });

  it("returns empty diff for identical snapshots", () => {
    const a = walkRouter(buildSynthetic());
    const b = walkRouter(buildSynthetic());
    expect(diffSnapshots(a, b)).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
  });
});
