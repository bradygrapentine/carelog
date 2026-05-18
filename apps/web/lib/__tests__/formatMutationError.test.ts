import { describe, it, expect } from "vitest";
import { formatMutationError } from "../formatMutationError";

function trpcErr(code: string, message: string): unknown {
  return { data: { code }, message };
}

function trpcErrWithCause(
  code: string,
  message: string,
  causeMessage: string,
): unknown {
  return { data: { code }, message, cause: { message: causeMessage } };
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
      ["_pkey", "violates constraint users_org_pkey"],
      ["_check", "failed check constraint bar_age_check"],
      ["_excl", "violates exclusion baz_time_excl"],
      ["_unique", "duplicate key qux_email_unique"],
      ["_idx", "violates broken thing_name_idx"],
      ["_fkey", "violates foreign quux_owner_fkey"],
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

    // TD-188: PG_DIAG_RE gate prevents false-positive constraint stripping
    // on plain English error copy that happens to end in matching suffixes.
    it("BAD_REQUEST — leaves user copy alone when no PG diagnostic marker present (license_key)", () => {
      const out = formatMutationError(
        trpcErr("BAD_REQUEST", "The license_key field is required"),
      );
      expect(out).toBe("The license_key field is required");
    });

    it("BAD_REQUEST — strips constraint when message contains 'duplicate key' marker", () => {
      const out = formatMutationError(
        trpcErr(
          "BAD_REQUEST",
          "duplicate key value violates unique constraint memberships_org_id_user_id_key",
        ),
      );
      expect(out).not.toMatch(/memberships_org_id_user_id_key/);
    });

    it("BAD_REQUEST — strips constraint when message contains 'violates check constraint'", () => {
      const out = formatMutationError(
        trpcErr("BAD_REQUEST", "violates check constraint users_age_min_check"),
      );
      expect(out).not.toMatch(/users_age_min_check/);
    });

    it("BAD_REQUEST — leaves single-word identifier alone (this api_idx is invalid)", () => {
      const out = formatMutationError(
        trpcErr("BAD_REQUEST", "This api_idx is invalid"),
      );
      expect(out).toBe("This api_idx is invalid");
    });

    // TD-188 sentinel: cause.message is gate input only — its content must
    // NEVER appear in the formatted output. If cause carries PHI/PII, that
    // PHI must not leak via the gate path.
    it("BAD_REQUEST — strips constraint from outer message when cause.message contains PG diagnostic", () => {
      const out = formatMutationError(
        trpcErrWithCause(
          "BAD_REQUEST",
          "Failed to save member memberships_org_id_user_id_key",
          "duplicate key value in underlying table",
        ),
      );
      expect(out).not.toMatch(/memberships_org_id_user_id_key/);
      // Cause.message content does NOT appear in the output.
      expect(out).not.toMatch(/underlying table/);
    });

    it("BAD_REQUEST — never leaks PHI from cause.message into output (gate-input-only contract)", () => {
      const out = formatMutationError(
        trpcErrWithCause(
          "BAD_REQUEST",
          "Failed to invite",
          "duplicate key violates constraint at recipient_email=test@example.com",
        ),
      );
      // The fake-PHI email from cause.message MUST NOT appear in output.
      expect(out).not.toMatch(/test@example\.com/);
      expect(out).not.toMatch(/recipient_email=/);
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
