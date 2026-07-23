/**
 * Validates a value meant for a URL path segment and returns it encoded.
 * Rejects blanks and anything that could traverse or reshape the path
 * (`..`, `/`, `\`) before encoding.
 */
export declare function sanitizePathParam(value: string, paramName: string): string;
