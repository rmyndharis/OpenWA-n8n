/**
 * Reads a node parameter declared as `type: 'json'`, which reaches the handler as
 * either the text the user typed or, when the field is driven by a single
 * expression, an already-resolved object. Both shapes are accepted.
 *
 * Returns undefined when nothing was supplied, so a caller can omit the key rather
 * than send a blank one. Throws SyntaxError on malformed text; callers wrap that in
 * a NodeOperationError naming the field.
 */
export function parseJsonParam(raw: unknown): unknown {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return JSON.parse(trimmed);
}

/**
 * Key-order-insensitive serialisation, for comparing a value the node sent against
 * the same value read back from the server. The server round-trips filters through
 * a JSON column, and some backends do not preserve key order, so a plain
 * JSON.stringify comparison would report drift that is not there and re-register
 * the webhook on every activation.
 */
export function stableStringify(value: unknown, seen: Set<object> = new Set()): string {
  // Mirror JSON.stringify's own conversion so a value and its JSON form agree. A
  // Date would otherwise serialise as {} here and as a string on the wire, which
  // would read as drift on every comparison.
  let current = value;
  if (current !== null && typeof current === 'object') {
    const withToJson = current as { toJSON?: () => unknown };
    if (typeof withToJson.toJSON === 'function') {
      current = withToJson.toJSON();
    }
  }

  if (current === null || typeof current !== 'object') {
    // JSON.stringify throws on a BigInt, the one primitive it refuses. This helper
    // decides whether a webhook re-registers, so it must answer rather than throw.
    if (typeof current === 'bigint') {
      return JSON.stringify(String(current));
    }
    return JSON.stringify(current ?? null) ?? 'null';
  }

  // Total by construction: a caller can hand this an expression-built value, and a
  // utility that decides whether to re-register a webhook must never throw. A cycle
  // cannot come back from the server, so marking it is enough to keep the compare
  // meaningful rather than crashing activation.
  const container = current as object;
  if (seen.has(container)) {
    return '"[Circular]"';
  }
  seen.add(container);
  try {
    if (Array.isArray(current)) {
      return `[${current.map((item) => stableStringify(item, seen)).join(',')}]`;
    }
    const entries = Object.entries(current as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && typeof v !== 'function')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v, seen)}`).join(',')}}`;
  } finally {
    seen.delete(container);
  }
}
