/**
 * The Server URL from the credential, ready to prepend an `/api/...` path to.
 *
 * Pasted values often carry trailing whitespace or more than one trailing slash.
 * n8n's own credential test joins the URL with the path through axios, which
 * collapses every trailing slash, so a value the test accepts must not become
 * `//api/...` here.
 */
export function serverBaseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}
