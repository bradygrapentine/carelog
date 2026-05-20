import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export type ProcedureType = "query" | "mutation" | "subscription";

export type ProcedureSnapshot = {
  type: ProcedureType;
  input: unknown | null;
  output: unknown | null;
};

export type RouterSnapshot = Record<string, ProcedureSnapshot>;

type AnyProcedure = {
  _def: {
    type?: ProcedureType;
    query?: boolean;
    mutation?: boolean;
    subscription?: boolean;
    inputs?: ZodTypeAny[];
    output?: ZodTypeAny;
  };
};

type AnyRouter = {
  _def: {
    procedures?: Record<string, AnyProcedure | AnyRouter>;
    record?: Record<string, AnyProcedure | AnyRouter>;
    router?: boolean;
  };
};

function hasDef(node: unknown): node is { _def: Record<string, unknown> } {
  if (node === null || node === undefined) return false;
  const t = typeof node;
  // tRPC procedures are callable (typeof "function") with attached _def;
  // routers are plain objects. Accept both.
  if (t !== "object" && t !== "function") return false;
  return "_def" in (node as object);
}

function isRouter(node: unknown): node is AnyRouter {
  if (!hasDef(node)) return false;
  return (node as AnyRouter)._def?.router === true;
}

function isProcedure(node: unknown): node is AnyProcedure {
  if (!hasDef(node)) return false;
  const def = (node as AnyProcedure)._def;
  if ((def as { router?: boolean }).router === true) return false;
  return (
    typeof def.type === "string" ||
    def.query === true ||
    def.mutation === true ||
    def.subscription === true
  );
}

function detectType(proc: AnyProcedure): ProcedureType {
  if (proc._def.type) return proc._def.type;
  if (proc._def.mutation) return "mutation";
  if (proc._def.subscription) return "subscription";
  return "query";
}

function convertSchema(schema: ZodTypeAny | undefined): unknown | null {
  if (!schema) return null;
  try {
    return zodToJsonSchema(schema, {
      target: "openApi3",
      $refStrategy: "none",
    });
  } catch {
    return { __lossy: true, reason: "zod-to-json-schema threw" };
  }
}

function mergeInputs(inputs: ZodTypeAny[] | undefined): unknown | null {
  if (!inputs || inputs.length === 0) return null;
  if (inputs.length === 1) return convertSchema(inputs[0]);
  return inputs.map((s) => convertSchema(s));
}

/**
 * Walks a tRPC router (v11) and returns a flat snapshot keyed by dot-path
 * ("<router>.<procedure>") with the JSON Schema for each procedure's
 * input + output and its kind. Stable key order — callers stringify directly.
 *
 * Known-lossy cases (documented in ADR-0006):
 *   - `z.record(z.unknown())` collapses to `{ type: "object" }` (no keys/values).
 *   - `z.lazy(() => ...)` may serialize as `{}` (no schema introspection).
 *   - `z.brand(...)` strips the brand at runtime — branded types appear as their
 *     underlying schema.
 *
 * The drift-detection failure message names the offending dot-path and hints
 * at the API_VERSION bump protocol.
 */
export function walkRouter(appRouter: unknown): RouterSnapshot {
  const result: RouterSnapshot = {};

  function visit(node: unknown, prefix: string) {
    if (!isRouter(node)) return;
    const entries = node._def.procedures ?? node._def.record ?? {};
    for (const [key, child] of Object.entries(entries)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isRouter(child)) {
        visit(child, path);
      } else if (isProcedure(child)) {
        result[path] = {
          type: detectType(child),
          input: mergeInputs(child._def.inputs),
          output: convertSchema(child._def.output),
        };
      }
    }
  }

  visit(appRouter, "");

  const sorted: RouterSnapshot = {};
  for (const key of Object.keys(result).sort()) sorted[key] = result[key];
  return sorted;
}

export function diffSnapshots(
  baseline: RouterSnapshot,
  current: RouterSnapshot,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  const baselineKeys = new Set(Object.keys(baseline));
  const currentKeys = new Set(Object.keys(current));

  for (const key of currentKeys) {
    if (!baselineKeys.has(key)) added.push(key);
    else if (JSON.stringify(baseline[key]) !== JSON.stringify(current[key]))
      changed.push(key);
  }
  for (const key of baselineKeys) {
    if (!currentKeys.has(key)) removed.push(key);
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
  };
}

export function formatDriftMessage(
  diff: ReturnType<typeof diffSnapshots>,
  apiVersion: string,
): string {
  const lines: string[] = [
    "tRPC schema drift detected vs checked-in snapshot.",
  ];
  if (diff.added.length)
    lines.push(`  Added procedures: ${diff.added.join(", ")}`);
  if (diff.removed.length)
    lines.push(`  Removed procedures: ${diff.removed.join(", ")}`);
  if (diff.changed.length)
    lines.push(`  Changed schemas at: ${diff.changed.join(", ")}`);
  lines.push("");
  lines.push(`Current API_VERSION: ${apiVersion}`);
  lines.push(
    "If this drift is intentional, bump API_VERSION in apps/web/server/api-version.ts and re-run with UPDATE_SCHEMA_SNAPSHOT=1 to refresh the baseline. See docs/adr/0006-trpc-schema-snapshots.md.",
  );
  return lines.join("\n");
}
