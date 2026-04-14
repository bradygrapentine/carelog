// Thin structured logger for the web app.
// In production, emits JSON-serialisable objects so log aggregators (Sentry,
// Datadog, CloudWatch, etc.) can parse them. In development, delegates to the
// native console so the Next.js terminal remains readable.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info("[route] something happened", { detail });
//   logger.warn("[route] degraded path taken", error);
//   logger.error("[route] unrecoverable failure", error);

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV === "production") {
    // Structured JSON line — one object per log entry.
    const entry: Record<string, unknown> = {
      level,
      msg: message,
      ts: new Date().toISOString(),
    };
    if (args.length === 1 && args[0] instanceof Error) {
      entry["err"] = { message: args[0].message, stack: args[0].stack };
    } else if (args.length > 0) {
      entry["data"] = args.length === 1 ? args[0] : args;
    }
    // eslint-disable-next-line no-console
    console[level](JSON.stringify(entry));
  } else {
    // Dev: readable multi-arg output identical to raw console calls.
    // eslint-disable-next-line no-console
    console[level](message, ...args);
  }
}

export const logger = {
  info: (message: string, ...args: unknown[]) => emit("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => emit("warn", message, ...args),
  error: (message: string, ...args: unknown[]) =>
    emit("error", message, ...args),
};
