"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpStatusFromError = httpStatusFromError;
/**
 * Reads the HTTP status from an error thrown by httpRequestWithAuthentication.
 * The status may appear as a numeric `statusCode`, a string `httpCode` (once
 * wrapped in a NodeApiError), or under `response.status`. Returns undefined when
 * no status can be read (network/DNS errors, timeouts) — callers treat that as
 * "not a definitive HTTP status" and do not match it against 404.
 */
function httpStatusFromError(error) {
    const err = error;
    const raw = err.httpCode ?? err.statusCode ?? err.response?.status;
    const status = Number(raw);
    return Number.isFinite(status) ? status : undefined;
}
//# sourceMappingURL=httpStatus.js.map