/**
 * Identity of this CLI as a makesPDF API client.
 *
 * Every request the CLI sends to the makesPDF API carries
 * `X-MakesPDF-Client: cli/<package version>` so the server can classify CLI
 * traffic by client kind. Per operator decision 2f382669, official clients
 * send plain `<kind>/<version>` values and the server matches them exactly.
 *
 * This module is the single source of truth for that header: both
 * `ApiClient` and the raw device-flow login requests spread
 * `clientHeaders()`.
 */
import pkg from "../package.json";

/** Client kind, as recognised by the server's known-client list. */
export const CLIENT_KIND = "cli";

/** Version of the CLI package, inlined from package.json at build time. */
export const CLIENT_VERSION: string = pkg.version;

/** Value sent in the `X-MakesPDF-Client` header, e.g. `cli/0.2.0`. */
export const CLIENT_NAME = `${CLIENT_KIND}/${CLIENT_VERSION}`;

/** Name of the header carrying the client identity. */
export const CLIENT_HEADER = "X-MakesPDF-Client";

/**
 * Headers common to every makesPDF API request from the CLI, before auth.
 * Callers add `Authorization` or per-request headers on top.
 */
export function clientHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "@makespdf/cli",
    [CLIENT_HEADER]: CLIENT_NAME,
  };
}
