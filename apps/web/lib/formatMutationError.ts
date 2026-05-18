/**
 * Format a mutation error for display to end-users without leaking schema
 * details (Postgres constraint names, Zod field paths, internal causes).
 *
 * Design:
 * - Whitelist a set of safe tRPC codes (`BAD_REQUEST`, `CONFLICT`,
 *   `NOT_FOUND`, `UNAUTHORIZED`). For those, return `err.message` with
 *   Postgres-constraint suffixes (`_pkey`, `_key`, `_idx`, `_fkey`,
 *   `_check`, `_excl`, `_unique`) and Zod field-path prefixes
 *   (`Invalid input: foo.bar `) stripped out.
 * - Multi-issue Zod errors are split on `\n` or `;` and each segment is
 *   stripped independently, then re-joined with `; `. Truly malformed
 *   inputs fall through to the canonical friendly fallback per code.
 * - All other codes (`INTERNAL_SERVER_ERROR`, `TIMEOUT`, unknown) and
 *   non-tRPC errors return the canonical generic string —
 *   "Something went wrong. Please try again." — to avoid leaking server
 *   internals.
 *
 * Caller wires this at the `onError` site:
 *   onError: (err) =>
 *     editMode.handlers.onError({ message: formatMutationError(err) })
 */

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const SAFE_CODE_FALLBACKS: Record<string, string> = {
  BAD_REQUEST: "Please check your input and try again.",
  CONFLICT: "That conflicts with an existing record.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  UNAUTHORIZED: "You don't have permission to do that.",
};

// Postgres constraint-name pattern: requires snake_case identifier with at
// least one internal underscore (e.g. `memberships_org_id_user_id_key`),
// preventing false positives on plain English words ending in matching
// suffixes (`license_key`, `api_idx`). Stripped globally, case-insensitive.
const POSTGRES_CONSTRAINT_RE =
  /\b[a-z][a-z0-9]*(_[a-z0-9]+){1,}_(pkey|fkey|key|idx|check|excl|unique)\b/gi;

// PG diagnostic-marker gate: only run constraint stripping when the error
// string actually looks like a Postgres diagnostic — otherwise plain user
// copy that happens to contain `_key` / `_idx` words slips through unchanged.
const PG_DIAG_RE = /\b(duplicate key|violates|constraint)\b/i;

// Zod single-issue prefix: `Invalid input: <dot.path>` — strip up to and
// including the path token (trailing whitespace optional so segments with
// nothing after the path collapse to empty and fall through to the
// canonical friendly fallback). Applied to one segment at a time.
const ZOD_PREFIX_RE = /^Invalid input:\s*\S+\s*/;

function stripOneSegment(seg: string, stripPgConstraint: boolean): string {
  // Trim BEFORE applying ZOD_PREFIX_RE — the anchor `^` would otherwise
  // miss segments that begin with whitespace after splitting on `;` /
  // `\n` (common with `"; "` join in multi-issue Zod errors).
  const zodStripped = seg.trim().replace(ZOD_PREFIX_RE, "");
  const pgStripped = stripPgConstraint
    ? zodStripped.replace(POSTGRES_CONSTRAINT_RE, "")
    : zodStripped;
  return pgStripped.trim();
}

function stripSchemaDetails(message: string, stripPgConstraint: boolean): string {
  const segments = String(message).split(/[\n;]/);
  const cleaned = segments
    .map((s) => stripOneSegment(s, stripPgConstraint))
    .filter((s) => s.length > 0);
  return cleaned.join("; ").trim();
}

function extractCauseMessage(err: unknown): string {
  if (err === null || typeof err !== "object") return "";
  const cause = (err as Record<string, unknown>)["cause"];
  if (cause === null || typeof cause !== "object") return "";
  const msg = (cause as Record<string, unknown>)["message"];
  return typeof msg === "string" ? msg : "";
}

function extractTrpcCode(err: unknown): string | null {
  if (err === null || typeof err !== "object") return null;
  const obj = err as Record<string, unknown>;

  // tRPC v11 shape: err.data.code
  const data = obj["data"];
  if (data && typeof data === "object") {
    const code = (data as Record<string, unknown>)["code"];
    if (typeof code === "string") return code;
  }

  // Some shapes expose code directly.
  const direct = obj["code"];
  if (typeof direct === "string") return direct;

  // shape.data.code fallback (less common).
  const shape = obj["shape"];
  if (shape && typeof shape === "object") {
    const sdata = (shape as Record<string, unknown>)["data"];
    if (sdata && typeof sdata === "object") {
      const code = (sdata as Record<string, unknown>)["code"];
      if (typeof code === "string") return code;
    }
  }

  return null;
}

function extractMessage(err: unknown): string | null {
  if (err === null || typeof err !== "object") return null;
  const msg = (err as Record<string, unknown>)["message"];
  return typeof msg === "string" ? msg : null;
}

export function formatMutationError(err: unknown): string {
  const code = extractTrpcCode(err);
  if (code === null || !(code in SAFE_CODE_FALLBACKS)) {
    return GENERIC_MESSAGE;
  }
  const raw = extractMessage(err);
  if (raw === null) {
    return SAFE_CODE_FALLBACKS[code];
  }
  // PG diagnostic detection: combine outer message + cause.message ONLY as
  // gate input. cause.message is NEVER copied into the output — `raw` (the
  // outer message) is the sole input to stripSchemaDetails. This keeps any
  // PHI / PII that might live in cause.message off the user-facing string.
  const causeMsg = extractCauseMessage(err);
  const gateInput = `${raw} ${causeMsg}`;
  const stripPgConstraint = PG_DIAG_RE.test(gateInput);
  const stripped = stripSchemaDetails(raw, stripPgConstraint);
  if (stripped.length === 0) {
    return SAFE_CODE_FALLBACKS[code];
  }
  return stripped;
}
