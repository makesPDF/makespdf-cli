import { ApiClient } from "./client.js";
import { loadConfig, resolveApiKey, resolveBaseUrl } from "./config.js";
import { EXIT, fail } from "./errors.js";

/**
 * Build an ApiClient from CLI flags + env + config. If no API key is
 * resolvable, print a helpful error pointing at `makespdf login` and exit.
 */
export function clientFromArgs(args: {
  "api-key"?: string;
  "base-url"?: string;
  json?: boolean;
}): ApiClient {
  const config = loadConfig();
  const apiKey = resolveApiKey(args["api-key"], config);
  const baseUrl = resolveBaseUrl(args["base-url"], config);

  if (!apiKey) {
    fail(
      "no API key found. Run `makespdf login` or set MAKESPDF_API_KEY.",
      EXIT.NETWORK,
      args.json === true,
    );
  }
  return new ApiClient({ baseUrl, apiKey });
}
