"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessions = getSessions;
exports.getGroups = getGroups;
exports.getChats = getChats;
exports.getContacts = getContacts;
exports.getTemplates = getTemplates;
exports.getLabels = getLabels;
exports.getWebhooks = getWebhooks;
exports.getChannels = getChannels;
exports.getApiKeys = getApiKeys;
/**
 * Dropdown loaders for the ID fields that have a listing endpoint behind them.
 *
 * Every field these back stays a plain string value, so a workflow that supplies
 * an ID from an expression keeps working — the dropdown is a convenience, never
 * the only way in.
 */
/**
 * Page size requested from the paginated list routes.
 *
 * Exactly one page is fetched. Walking every page would fire a request per
 * thousand records each time a dropdown opens — on an account with a large
 * contact list that is a lot of sequential round trips for a list nobody scrolls
 * to the end of. Beyond this many entries the field takes an expression instead.
 *
 * On every route this is currently sent to, the server's own default already
 * equals its cap, so the parameter changes nothing and only states the intent.
 */
const PAGE_SIZE = 1000;
/**
 * Pulls the array out of a listing response.
 *
 * Most OpenWA list routes return a bare array, but catalog products come back
 * as `{ products: [...] }`, and the OpenAPI spec declares no schema at all for
 * several of them. Rather than hard-code each shape, take the array if the body
 * is one, otherwise the first array-valued property.
 */
function extractList(response) {
    if (Array.isArray(response)) {
        return response;
    }
    if (response && typeof response === 'object') {
        for (const value of Object.values(response)) {
            if (Array.isArray(value)) {
                return value;
            }
        }
    }
    return [];
}
/** Runs one GET against the configured server using the node's credential. */
async function fetchPage(ctx, endpoint, qs) {
    const credentials = await ctx.getCredentials('openWaApi');
    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
    const response = await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'openWaApi', {
        method: 'GET',
        url: `${baseUrl}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        json: true,
        ...(qs ? { qs } : {}),
    });
    return extractList(response);
}
/**
 * Reads the Session ID the user has already picked, for the loaders whose
 * endpoint is nested under a session. Returns null when nothing is selected yet
 * so the dropdown stays empty instead of requesting a bogus URL.
 */
function currentSessionId(ctx) {
    const sessionId = ctx.getCurrentNodeParameter('sessionId');
    if (typeof sessionId !== 'string') {
        return null;
    }
    const trimmed = sessionId.trim();
    return trimmed ? encodeURIComponent(trimmed) : null;
}
/**
 * Builds the option list. `labelKeys` is tried in order so each resource can
 * show its most meaningful column, falling back to the raw id when a record has
 * no human-readable field.
 */
function toOptions(entries, labelKeys) {
    return entries
        .filter((entry) => typeof entry?.id === 'string' && entry.id !== '')
        .map((entry) => {
        const label = labelKeys
            .map((key) => entry[key])
            .find((value) => typeof value === 'string' && value.trim() !== '');
        const id = entry.id;
        return {
            // Showing the id alongside the name keeps entries distinguishable when
            // two groups, labels, or contacts share a display name.
            name: label ? `${label} (${id})` : id,
            value: id,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
/** Session-scoped loader for a route that returns everything in one response. */
async function sessionScoped(ctx, path, labelKeys) {
    const sessionId = currentSessionId(ctx);
    if (!sessionId) {
        return [];
    }
    return toOptions(await fetchPage(ctx, `/api/sessions/${sessionId}${path}`), labelKeys);
}
/** Session-scoped loader for a route that pages by limit/offset. */
async function sessionScopedPaginated(ctx, path, labelKeys) {
    const sessionId = currentSessionId(ctx);
    if (!sessionId) {
        return [];
    }
    return toOptions(await fetchPage(ctx, `/api/sessions/${sessionId}${path}`, { limit: PAGE_SIZE }), labelKeys);
}
// --- Paginated routes --------------------------------------------------------
async function getSessions() {
    return toOptions(await fetchPage(this, '/api/sessions', { limit: PAGE_SIZE }), ['name']);
}
async function getGroups() {
    return sessionScopedPaginated(this, '/groups', ['name']);
}
async function getChats() {
    return sessionScopedPaginated(this, '/chats', ['name']);
}
async function getContacts() {
    // pushName is the self-chosen WhatsApp display name, used when the contact is
    // not in the address book and therefore has no `name`.
    return sessionScopedPaginated(this, '/contacts', ['name', 'pushName', 'number']);
}
// --- Routes that return everything in one response ---------------------------
async function getTemplates() {
    return sessionScoped(this, '/templates', ['name']);
}
async function getLabels() {
    return sessionScoped(this, '/labels', ['name']);
}
async function getWebhooks() {
    // Webhooks carry no name — the delivery URL is what identifies one.
    return sessionScoped(this, '/webhooks', ['url']);
}
async function getChannels() {
    return sessionScoped(this, '/channels', ['name']);
}
async function getApiKeys() {
    return toOptions(await fetchPage(this, '/api/auth/api-keys'), ['name']);
}
