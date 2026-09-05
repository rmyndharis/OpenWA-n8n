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
/**
 * A node parameter read as text. An expression can resolve to a number, a boolean
 * or an object, and calling .trim() on one throws a TypeError that reaches the user
 * as an opaque API error naming no field. Coercing keeps the value usable where it
 * makes sense (a numeric id) and lets the emptiness and length checks below give a
 * pointed message where it does not.
 */
/** What an object with nothing useful to say stringifies to. */
const OPAQUE_OBJECT = '[object Object]';

export function asText(value: unknown, label = 'This field'): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    // Refused only when stringifying it carries NOTHING. The gateway validates with
    // implicit conversion, which rewrites the value before `@IsString()` sees it, so
    // "[object Object]" is accepted and reaches a chat as a real message; on
    // Message > Edit it overwrites text already delivered, which nothing can undo.
    //
    // Everything else keeps working, and that distinction is the point: a bare
    // `{{ $now }}` on a string field resolves to a Luxon DateTime OBJECT rather than
    // a string, and it stringifies to an ISO-8601 instant the gateway has always
    // taken. Refusing every object would break that, and a plain Date with it.
    let text: string;
    try {
      text = String(value);
    } catch {
      // A null-prototype object has no toString at all, so String() throws.
      text = OPAQUE_OBJECT;
    }
    if (text === OPAQUE_OBJECT) {
      throw new Error(
        `${label} must be text. Point the expression at the value itself, e.g. {{ $json.payload.text }}.`,
      );
    }
    return text.trim();
  }
  return typeof value === 'string' ? value.trim() : String(value).trim();
}

export function requireJid(
  ctx: IExecuteFunctions,
  paramName: string,
  label: string,
  itemIndex: number,
): string {
  const value = asText(ctx.getNodeParameter(paramName, itemIndex), label);
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
  const value = asText(ctx.getNodeParameter(paramName, itemIndex), label);
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
 *
 * A string of twelve or more digits is read as epoch-ms before `Date.parse` sees it.
 * Upstream JSON routinely carries a millisecond timestamp as text to avoid losing
 * precision, and `Date.parse` answers NaN for a 13-digit string, so the exact value
 * these routes want was being rejected as "not a valid date".
 *
 * Twelve is the floor because it is what separates milliseconds from every shorter
 * thing a numeric string can be. Epoch-SECONDS is ten digits and a compact date is
 * eight, and reading either as milliseconds lands in 1970: the request then succeeds
 * against a mute that has already expired, which is worse than the loud refusal
 * `Date.parse` gives them. A bare `2026` keeps its year reading for the same reason.
 */
export function toEpochMs(
  ctx: IExecuteFunctions,
  raw: unknown,
  label: string,
  itemIndex: number,
): number {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const ms =
    typeof raw === 'number' ? raw : /^\d{12,}$/.test(text) ? Number(text) : Date.parse(String(raw));
  // A bare number under four digits is refused rather than parsed. Date.parse reads
  // one as a year, so '0' (what Chat > List reports for an indefinite mute) resolves
  // to the year 2000 and the gateway accepts a mute that expired decades ago.
  if (!Number.isFinite(ms) || /^\d{1,3}$/.test(text)) {
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
  const trimmed = asText(value, label);
  if (!trimmed) {
    throw new NodeOperationError(
      ctx.getNode(),
      `${label} cannot be blank. Remove it from the fields to leave it unchanged.`,
      { itemIndex },
    );
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new NodeOperationError(ctx.getNode(), `${label} cannot exceed ${maxLength} characters`, {
      itemIndex,
    });
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
function listEntry(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    throw new Error(
      'List entries must be text. Map the expression to the values themselves, e.g. {{ $json.items.map((i) => i.id) }}.',
    );
  }
  return String(value ?? '').trim();
}

export function toStringList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map(listEntry).filter(Boolean);
  }

  if (typeof raw !== 'string') {
    return [listEntry(raw)].filter(Boolean);
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    // Only the parse is guarded. Mapping inside the try swallowed the refusal
    // listEntry throws, and the text then fell through to the comma splitter, so a
    // pasted array of objects was chopped into JSON fragments instead of refused.
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Not valid JSON after all: fall through and treat it as a plain separated
      // list rather than failing on a stray bracket.
    }
    if (Array.isArray(parsed)) {
      return parsed.map(listEntry).filter(Boolean);
    }
  }

  return trimmed
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}
