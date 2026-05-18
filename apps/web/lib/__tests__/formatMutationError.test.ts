import { describe, it, expect } from "vitest";
import { formatMutationError } from "../formatMutationError";

function trpcErr(code: string, message: string): unknown {
  return { data: { code }, message };
}

describe("formatMutationError", () => {
  describe("safe-code pass-through with schema-detail stripping", () => {
    it("BAD_REQUEST — strips Postgres `_key` constraint name", () => {
      const out = formatMutationError(
        trpcErr(
          "BAD_REQUEST",
          "duplicate key value violates unique constraint memberships_org_id_user_id_key",
        ),
      );
      expect(out).not.toMatch(/memberships_org_id_user_id_key/);
      // The phrase "memberships_org_id_user_id_" remains as a residual fragment
      // (the suffix was stripped). Confirm the constraint identifier IS gone.
      expect(out).not.toMatch(/_key\b/);
    });

    it.each([
      ["_pkey", "violates pkey foo_pkey"],
      ["_check", "failed check bar_check"],
      ["_excl", "exclusion baz_excl"],
      ["_unique", "duplicate qux_unique"],
      ["_idx", "broken thing_idx"],
      ["_fkey", "foreign quux_fkey"],
    ])("BAD_REQUEST — strips Postgres `%s` constraint suffix", (suffix, raw) => {
      const out = formatMutationError(trpcErr("BAD_REQUEST", raw));
      expect(out).not.toMatch(new RegExp(suffix + "\\b"));
    });

    it("BAD_REQUEST — strips Zod single-issue field-path prefix", () => {
      const out = formatMutationError(
        trpcErr(
          "BAD_REQUEST",
          "Invalid input: members.0.email Expected string, received number",
        ),
      );
      expect(out).not.toMatch(/Invalid input:/);
      expect(out).not.toMatch(/members\.0\.email/);
      expect(out).toMatch(/Expected string/);
    });

    it("BAD_REQUEST — handles multi-issue Zod errors by splitting on `;`", () => {
      const out = formatMutationError(
        trpcErr(
          "BAD_REQUEST",
          "Invalid input: a.b Required; Invalid input: c.d Too short",
        ),
      );
      expect(out).not.toMatch(/Invalid input:/);
      expect(out).not.toMatch(/a\.b/);
      expect(out).not.toMatch(/c\.d/);
      expect(out).toMatch(/Required/);
      expect(out).toMatch(/Too short/);
    });

    it("CONFLICT — returns safe message as-is", () => {
      const out = formatMutationError(
        trpcErr("CONFLICT", "Already invited"),
      );
      expect(out).toBe("Already invited");
    });

    it("BAD_REQUEST — empty after strip falls back to canonical friendly string", () => {
      const out = formatMutationError(
        trpcErr("BAD_REQUEST", "Invalid input: x.y "),
      );
      expect(out).toBe("Please check your input and try again.");
    });
  });

  describe("unsafe-code generic fallback", () => {
    it("INTERNAL_SERVER_ERROR — returns generic message", () => {
      const out = formatMutationError(
        trpcErr("INTERNAL_SERVER_ERROR", "ECONNREFUSED 127.0.0.1:5432"),
      );
      expect(out).toBe("Something went wrong. Please try again.");
    });

    it("TIMEOUT — returns generic message", () => {
      const out = formatMutationError(
        trpcErr("TIMEOUT", "Query exceeded 30s"),
      );
      expect(out).toBe("Something went wrong. Please try again.");
    });

    it("unknown code — returns generic message", () => {
      const out = formatMutationError(trpcErr("SOMETHING_WEIRD", "leak"));
      expect(out).toBe("Something went wrong. Please try again.");
    });

    it("non-tRPC Error — returns generic message", () => {
      const out = formatMutationError(new Error("kaboom internals"));
      expect(out).toBe("Something went wrong. Please try again.");
    });

    it("undefined — returns generic message", () => {
      const out = formatMutationError(undefined);
      expect(out).toBe("Something went wrong. Please try again.");
    });

    it("null — returns generic message", () => {
      const out = formatMutationError(null);
      expect(out).toBe("Something went wrong. Please try again.");
    });
  });
});
