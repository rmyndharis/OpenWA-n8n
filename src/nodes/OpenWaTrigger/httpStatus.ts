/**
 * Reads the HTTP status from an error thrown by httpRequestWithAuthentication.
 * The status may appear as a numeric `statusCode`, a string `httpCode` (once
 * wrapped in a NodeApiError), or under `response.status`. Returns undefined when
 * no status can be read (network/DNS errors, timeouts) — callers treat that as
 * "not a definitive HTTP status" and do not match it against 404.
 */
export function httpStatusFromError(error: unknown): number | undefined {
  const err = error as Record<string, unknown>;
  const raw = err.httpCode ?? err.statusCode ?? (err.response as Record<string, unknown>)?.status;
  const status = Number(raw);
  return Number.isFinite(status) ? status : undefined;
}
