/**
 * Real OCR provider integration is not yet wired (TD-203). Until it is, an OCR
 * job has no genuine parse result. In production we must NOT fabricate one onto
 * a real medical upload — return null so the caller marks the job `failed` and
 * the UI prompts manual entry instead of presenting invented fields for human
 * confirmation. The stub text is a local/dev/test fixture only.
 */
export function resolveOcrStub(
  stub: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | null {
  return nodeEnv === "production" ? null : stub;
}
