import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
export declare function asText(value: unknown, label?: string): string;
export declare function requireJid(ctx: IExecuteFunctions, paramName: string, label: string, itemIndex: number): string;
/**
 * Reads a required free-text parameter, trimmed, optionally length-checked
 * against the server's DTO limit so oversized input fails with a pointed
 * message instead of a generic 400.
 */
export declare function requireText(ctx: IExecuteFunctions, paramName: string, label: string, itemIndex: number, maxLength?: number): string;
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
 * message that names the field and says how to leave it unchanged.
 */
export declare function optionalNonBlank(ctx: IExecuteFunctions, value: string | undefined, label: string, itemIndex: number, maxLength?: number): string | undefined;
export declare function toStringList(raw: unknown): string[];
