import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * Reads a required WhatsApp JID (e.g. 628123456789@c.us, 1203630@g.us) and
 * returns it trimmed. Callers that put it in a URL path wrap it in
 * `encodeURIComponent`; callers that send it in a body use it as-is.
 *
 * Kept apart from sanitizePathParam because a JID legitimately contains `@` and
 * `.`, and because the caller needs a NodeOperationError carrying the item index
 * rather than the bare Error that helper throws.
 */
export function requireJid(
  ctx: IExecuteFunctions,
  paramName: string,
  label: string,
  itemIndex: number,
): string {
  const value = (ctx.getNodeParameter(paramName, itemIndex) as string).trim();
  if (!value) {
    throw new NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
  }
  return value;
}

/**
 * Reads a required free-text parameter, trimmed, optionally length-checked
 * against the server's DTO limit so oversized input fails with a pointed
 * message instead of a generic 400.
 */
export function requireText(
  ctx: IExecuteFunctions,
  paramName: string,
  label: string,
  itemIndex: number,
  maxLength?: number,
): string {
  const value = (ctx.getNodeParameter(paramName, itemIndex) as string).trim();
  if (!value) {
    throw new NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
  }
  if (maxLength !== undefined && value.length > maxLength) {
    throw new NodeOperationError(ctx.getNode(), `${label} cannot exceed ${maxLength} characters`, {
      itemIndex,
    });
  }
  return value;
}

/**
 * Turns a `collection` parameter into a query object.
 *
 * Only entries the user actually added are present, so anything left undefined,
 * null, or blank is dropped. `0` and `false` are meaningful values here (offset
 * 0, a disabled flag) and are deliberately kept.
 */
export function toQueryParams(options: IDataObject | undefined): IDataObject {
  const qs: IDataObject = {};
  for (const [key, value] of Object.entries(options ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      qs[key] = value;
    }
  }
  return qs;
}

/**
 * Converts an n8n `dateTime` parameter to the epoch-ms number the API binds.
 *
 * The UI hands us an ISO-8601 string, but the server's query DTOs declare these
 * bounds as numbers and reject anything `Number()` cannot parse. A value that is
 * already numeric passes straight through, so an expression supplying epoch-ms
 * keeps working.
 */
export function toEpochMs(
  ctx: IExecuteFunctions,
  raw: unknown,
  label: string,
  itemIndex: number,
): number {
  const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
  if (!Number.isFinite(ms)) {
    throw new NodeOperationError(ctx.getNode(), `${label} is not a valid date`, { itemIndex });
  }
  return ms;
}

/**
 * Reads an optional text field from an update collection, for the fields the server
 * marks non-empty.
 *
 * Three states have to stay distinct. Absent means "leave the stored value alone",
 * so it returns undefined and the caller omits the key. A real value is trimmed and
 * returned. A value that is present but blank is neither: the server refuses it, so
 * there is no reading under which it means anything. Dropping it silently would
 * report success while leaving the field untouched, so it is refused here with a
 * message that names the field and says how to leave it unchanged.
 */
export function optionalNonBlank(
  ctx: IExecuteFunctions,
  value: string | undefined,
  label: string,
  itemIndex: number,
  maxLength?: number,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new NodeOperationError(
      ctx.getNode(),
      `${label} cannot be blank. Remove it from the fields to leave it unchanged.`,
      { itemIndex },
    );
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new NodeOperationError(
      ctx.getNode(),
      `${label} cannot exceed ${maxLength} characters`,
      { itemIndex },
    );
  }
  return trimmed;
}

/**
 * Normalises a list parameter into a trimmed, blank-free array of strings.
 *
 * These fields are plain strings rather than n8n `multipleValues` collections so
 * that they can be driven by an expression — a fixed set of input rows cannot
 * scale to a list only known at runtime. That means three shapes reach us, and
 * all three are accepted:
 *
 *   - a real array, when an expression resolves to one (`{{ $json.ids }}`)
 *   - a JSON array string, when one is pasted or built as text
 *   - a comma- or newline-separated string, when typed by hand
 *
 * Returns an empty array when nothing was provided.
 */
export function toStringList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof raw !== 'string') {
    return [String(raw).trim()].filter(Boolean);
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Not valid JSON after all — fall through and treat it as a plain
      // separated list rather than failing on a stray bracket.
    }
  }

  return trimmed
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}
