"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asText = asText;
exports.requireJid = requireJid;
exports.requireFullJid = requireFullJid;
exports.inviteCodeFrom = inviteCodeFrom;
exports.requireText = requireText;
exports.textLength = textLength;
exports.toQueryParams = toQueryParams;
exports.toEpochMs = toEpochMs;
exports.optionalNonBlank = optionalNonBlank;
exports.toStringList = toStringList;
const n8n_workflow_1 = require("n8n-workflow");
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
function asText(value, label = 'This field') {
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
        let text;
        try {
            text = String(value);
        }
        catch {
            // A null-prototype object has no toString at all, so String() throws.
            text = OPAQUE_OBJECT;
        }
        // Also caught inside a longer string: a list of two objects stringifies to
        // "[object Object],[object Object]", and a Map or Set to "[object Map]".
        if (text.includes('[object ')) {
            throw new Error(`${label} must be text. Point the expression at the value itself, e.g. {{ $json.payload.text }}.`);
        }
        return text.trim();
    }
    return typeof value === 'string' ? value.trim() : String(value).trim();
}
function requireJid(ctx, paramName, label, itemIndex) {
    const value = asText(ctx.getNodeParameter(paramName, itemIndex), label);
    if (!value) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
    }
    return value;
}
/**
 * requireJid for the routes whose DTO requires a domain-qualified ID
 * (`@Matches(/^[^\s@]+@[^\s@]+$/)`). Checking here lets the message name the field,
 * where the server's 400 detail is stripped in production. The example is fixed
 * rather than built from the rejected value, which is not a valid ID.
 */
function requireFullJid(ctx, paramName, label, itemIndex) {
    const value = requireJid(ctx, paramName, label, itemIndex);
    if (!/^[^\s@]+@[^\s@]+$/.test(value)) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} must be a full WhatsApp ID including its domain, such as 628123456789@c.us, not a bare number`, { itemIndex });
    }
    return value;
}
/**
 * The invite code in a pasted WhatsApp group or channel link, or the text itself when
 * it is not a link. Current links carry a query string (`?mode=gi_t`), and some a
 * trailing slash, a fragment or an `/invite/` segment, none of which is part of the
 * code. The code follows `/channel/` or `/invite/` when either is present and is the
 * first path segment otherwise; a link that stops before it yields ''.
 */
function inviteCodeFrom(text) {
    if (!text.includes('/')) {
        return text;
    }
    try {
        const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
        const segments = url.pathname.split('/').filter(Boolean);
        const marker = segments.findIndex((s) => s === 'channel' || s === 'invite');
        return (marker >= 0 ? segments[marker + 1] : segments[0]) ?? '';
    }
    catch {
        return text;
    }
}
/**
 * Reads a required free-text parameter, trimmed, optionally length-checked
 * against the server's DTO limit so oversized input fails with a pointed
 * message instead of a generic 400.
 */
function requireText(ctx, paramName, label, itemIndex, maxLength) {
    const value = asText(ctx.getNodeParameter(paramName, itemIndex), label);
    if (!value) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
    }
    if (maxLength !== undefined && textLength(value) > maxLength) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot exceed ${maxLength} characters`, {
            itemIndex,
        });
    }
    return value;
}
/**
 * Length as the gateway's @MaxLength counts it (validator's isLength): a surrogate
 * pair, such as most emoji, is one character, and so is a character together with
 * its emoji or text presentation selector. String.length counts UTF-16 units, which
 * refused emoji text the gateway accepts.
 */
function textLength(text) {
    const selectors = text.match(/[^️︎][️︎]/g)?.length ?? 0;
    const pairs = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0;
    return text.length - selectors - pairs;
}
/**
 * Turns a `collection` parameter into a query object.
 *
 * Only entries the user actually added are present, so anything left undefined,
 * null, or blank is dropped. `0` and `false` are meaningful values here (offset
 * 0, a disabled flag) and are deliberately kept.
 */
function toQueryParams(options) {
    const qs = {};
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
function toEpochMs(ctx, raw, label, itemIndex) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    // The number form gets the same floor as the twelve-digit rule below. The
    // gateway's payload timestamps are Unix seconds, so {{ $json.data.timestamp + 86400 }}
    // arrives as a ten-digit number and read as milliseconds it lands in January 1970,
    // which the gateway accepts as a mute that has already expired.
    if (typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) < 1e11) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} looks like epoch seconds. Epoch values are milliseconds, not seconds.`, { itemIndex });
    }
    const zoned = ZONELESS_DATE_TIME.test(text)
        ? wallTimeToEpochMs(text, ctx.getTimezone?.())
        : undefined;
    const ms = typeof raw === 'number'
        ? raw
        : /^\d{12,}$/.test(text)
            ? Number(text)
            : (zoned ?? Date.parse(String(raw)));
    // A bare number under four digits is refused rather than parsed. Date.parse reads
    // one as a year, so '0' (what Chat > List reports for an indefinite mute) resolves
    // to the year 2000 and the gateway accepts a mute that expired decades ago. A
    // signed one is read as a year the same way ('-1' is 2001).
    if (!Number.isFinite(ms) || /^\d{1,3}$/.test(text) || /^[+-]\d+$/.test(text)) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} is not a valid date`, { itemIndex });
    }
    return ms;
}
/** What n8n's date picker stores: a wall-clock time with no zone. */
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
/**
 * Reads a zone-less wall-clock time in the workflow's timezone. Date.parse reads it
 * in the n8n process's zone instead, which in a container is usually UTC, so a mute
 * picked for 09:00 in Jakarta ended seven hours late.
 */
function wallTimeToEpochMs(text, timeZone) {
    if (!timeZone) {
        return undefined;
    }
    const asUtc = Date.parse(`${text}Z`);
    const format = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    });
    // The zone's offset from UTC at an instant, from how that instant reads there.
    const offsetAt = (instant) => {
        const part = Object.fromEntries(format.formatToParts(new Date(instant)).map((p) => [p.type, Number(p.value)]));
        const wall = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
        return wall - (instant - (((instant % 1000) + 1000) % 1000));
    };
    // Two passes, because the offset to subtract is the one in force at the answer,
    // which differs from the one at the first guess across a daylight-saving change.
    const guess = asUtc - offsetAt(asUtc);
    return asUtc - offsetAt(guess);
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
function optionalNonBlank(ctx, value, label, itemIndex, maxLength) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const trimmed = asText(value, label);
    if (!trimmed) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot be blank. Remove it from the fields to leave it unchanged.`, { itemIndex });
    }
    if (maxLength !== undefined && textLength(trimmed) > maxLength) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot exceed ${maxLength} characters`, {
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
function listEntry(value) {
    if (typeof value === 'object' && value !== null) {
        throw new Error('List entries must be text. Map the expression to the values themselves, e.g. {{ $json.items.map((i) => i.id) }}.');
    }
    return String(value ?? '').trim();
}
function toStringList(raw) {
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
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
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
