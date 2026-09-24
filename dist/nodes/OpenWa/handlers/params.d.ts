import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
export declare function asText(value: unknown, label?: string): string;
/**
 * A boolean parameter read as the user meant it. n8n does not coerce a boolean field
 * driven by an expression, so it can arrive as text from a sheet, a form or a query
 * string, where 'false' is truthy. Truthiness stays the reading for everything else,
 * so every value that used to switch a toggle on still does.
 */
export declare function isOn(value: unknown): boolean;
/**
 * Whether a raw, unresolved node parameter is an expression: n8n stores one as a
 * string starting with '='. Read from getNode().parameters, never from the resolved
 * value, where a field left empty and an expression that found nothing look alike.
 */
export declare function isExpression(raw: unknown): boolean;
/**
 * Whether a raw parameter is an expression that renders as text around or between
 * its {{ }} blocks, as opposed to one block that is the whole value. n8n renders a
 * missing field inside such a template as '', so it can come out as whitespace
 * alone; a whole-value block returns undefined for a missing field instead, and a
 * real '' from one is a deliberate value.
 */
export declare function isTemplateExpression(raw: unknown): boolean;
export declare function requireJid(ctx: IExecuteFunctions, paramName: string, label: string, itemIndex: number): string;
/**
 * requireJid for the routes whose DTO requires a domain-qualified ID
 * (`@Matches(/^[^\s@]+@[^\s@]+$/)`). Checking here lets the message name the field,
 * where the server's 400 detail is stripped in production. The example is fixed
 * rather than built from the rejected value, which is not a valid ID.
 */
export declare function requireFullJid(ctx: IExecuteFunctions, paramName: string, label: string, itemIndex: number): string;
/**
 * The invite code in a pasted WhatsApp group or channel link, or the text itself when
 * it is not a link. Current links carry a query string (`?mode=gi_t`), and some a
 * trailing slash, a fragment or an `/invite/` segment, none of which is part of the
 * code. The code is a `code` query parameter when there is one (the app's
 * `whatsapp://chat/?code=` deep link), follows `/channel/` or `/invite/` when either
 * is present, and is the first path segment otherwise; a link that stops before it
 * yields ''.
 */
export declare function inviteCodeFrom(text: string): string;
/**
 * Reads a required free-text parameter, trimmed, optionally length-checked
 * against the server's DTO limit so oversized input fails with a pointed
 * message instead of a generic 400.
 */
export declare function requireText(ctx: IExecuteFunctions, paramName: string, label: string, itemIndex: number, maxLength?: number): string;
/**
 * Length as the gateway's @MaxLength counts it (validator's isLength): a surrogate
 * pair, such as most emoji, is one character, and so is a character together with
 * its emoji or text presentation selector. String.length counts UTF-16 units, which
 * refused emoji text the gateway accepts.
 */
export declare function textLength(text: string): number;
/**
 * Refuses a name longer than the varchar(max) column the gateway stores it in.
 * PostgreSQL counts code points, so a character with its presentation selector is two
 * there though one to the gateway's validator, and a name the validator accepts can
 * still fail the insert with a 500 that names no field. SQLite does not enforce the
 * length, but the node cannot tell which database a gateway runs, so the cap applies
 * to both; it is still looser than the UTF-16 count 1.0.1 used.
 */
export declare function assertStoredName(ctx: IExecuteFunctions, name: string, label: string, max: number, itemIndex: number): string;
/** The remedy an update route offers for a field with no value. */
export declare const LEAVE_UNCHANGED = "Remove it from the fields to leave it unchanged.";
/**
 * Refuses a collection field that was added but holds no value. A key appears in an
 * n8n collection only once its option is added, so undefined or null there comes from
 * an expression that found nothing, or from a number or options input cleared in the
 * editor, which n8n stores as null. Dropping the key reported a change that never
 * happened as a success. `remedy` says what to do instead, which depends on the route:
 * leaving a field out keeps it on an update but clears it on a whole-record write.
 */
export declare function assertFieldsResolved(ctx: IExecuteFunctions, fields: IDataObject, labels: Record<string, string>, remedy: string, itemIndex: number): void;
/**
 * Turns a `collection` parameter into a query object.
 *
 * Only entries the user actually added are present, so anything left undefined,
 * null, or blank is dropped. `0` and `false` are meaningful values here (offset
 * 0, a disabled flag) and are deliberately kept.
 */
export declare function toQueryParams(options: IDataObject | undefined): IDataObject;
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
export declare function toEpochMs(ctx: IExecuteFunctions, raw: unknown, label: string, itemIndex: number): number;
/**
 * Reads an optional text field from an update collection, for the fields the server
 * marks non-empty.
 *
 * Three states have to stay distinct. Absent means "leave the stored value alone",
 * so it returns undefined and the caller omits the key. A real value is trimmed and
 * returned. A value that is present but blank is neither: the server refuses it, so
 * there is no reading under which it means anything. Dropping it silently would
 * report success while leaving the field untouched, so it is refused here with a
 * message that names the field and says what to do instead, which on a whole-record
 * write is not "leave it out".
 */
export declare function optionalNonBlank(ctx: IExecuteFunctions, value: string | undefined, label: string, itemIndex: number, maxLength?: number, remedy?: string): string | undefined;
export declare function toStringList(raw: unknown): string[];
