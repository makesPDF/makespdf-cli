import { defineCommand } from "citty";
import { hostname } from "node:os";
import { resolveBaseUrl, loadConfig, saveConfig, configPath } from "../config.js";
import { EXIT, fail } from "../errors.js";
import { openBrowser } from "../open-browser.js";

/**
 * `makespdf login` — RFC 8628 OAuth Device Authorization Flow.
 *
 * 1. POST /api/v1/device/code     → { device_code, user_code, verification_uri_complete, interval }
 * 2. Show the user_code + URL; optionally open the browser.
 * 3. Poll POST /api/v1/device/token every `interval` seconds until approved.
 * 4. Save the returned access_token to ~/.config/makespdf/config.json.
 *
 * No local HTTP listener. No port wrangling. Works on headless machines
 * (the user can open the URL on any device).
 */

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

type PollResponse =
  | { access_token: string; token_type: string }
  | { error: string; interval?: number };

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description:
      "Sign in via the browser using the OAuth device authorization flow. Displays a short code, opens makespdf.com/device, and polls for approval.",
  },
  args: {
    "base-url": {
      type: "string",
      description: "Override the makesPDF base URL (default: https://makespdf.com).",
    },
    "no-browser": {
      type: "boolean",
      description: "Don't try to open a browser — just print the verification URL.",
      default: false,
    },
  },
  async run({ args }) {
    const config = loadConfig();
    const baseUrl = resolveBaseUrl(args["base-url"], config).replace(/\/+$/, "");

    // Step 1: request a device code
    let codeRes: DeviceCodeResponse;
    let codeHttp: Response;
    try {
      codeHttp = await fetch(`${baseUrl}/api/v1/device/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "@makespdf/cli" },
        body: JSON.stringify({ client_name: hostname() }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`couldn't reach ${baseUrl}: ${msg}`, EXIT.NETWORK, false);
    }
    if (!codeHttp.ok) {
      const body = await codeHttp.text().catch(() => "");
      fail(
        `failed to request device code (${codeHttp.status}): ${body.slice(0, 200)}`,
        EXIT.API,
        false,
      );
    }
    try {
      codeRes = (await codeHttp.json()) as DeviceCodeResponse;
    } catch {
      fail(`unexpected response from ${baseUrl}/api/v1/device/code`, EXIT.API, false);
    }

    // Step 2: show the code and open the browser
    const completeUrl = codeRes.verification_uri_complete ?? codeRes.verification_uri;
    process.stderr.write(
      `\nTo authorize this device, visit:\n\n    ${completeUrl}\n\nAnd confirm the code:\n\n    ${codeRes.user_code}\n\n`,
    );

    if (!args["no-browser"]) {
      try {
        await openBrowser(completeUrl);
      } catch {
        // Non-fatal — user can paste the URL manually.
      }
    }

    process.stderr.write(`Waiting for approval...\n`);

    // Step 3: poll until approved, denied, or expired.
    let intervalSeconds = codeRes.interval ?? 5;
    const deadline = Date.now() + (codeRes.expires_in ?? 600) * 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (Date.now() > deadline) {
        fail(
          `login timed out. Run 'makespdf login' again to get a fresh code.`,
          EXIT.NETWORK,
          false,
        );
      }
      await sleep(intervalSeconds * 1000);

      let pollRes: Response;
      try {
        pollRes = await fetch(`${baseUrl}/api/v1/device/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "@makespdf/cli" },
          body: JSON.stringify({ device_code: codeRes.device_code }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`network error while polling: ${msg}`, EXIT.NETWORK, false);
      }

      let body: PollResponse;
      try {
        body = (await pollRes.json()) as PollResponse;
      } catch {
        fail(`unexpected response from ${baseUrl}/api/v1/device/token`, EXIT.API, false);
      }

      if (pollRes.ok && "access_token" in body && body.access_token) {
        config.apiKey = body.access_token;
        if (args["base-url"]) config.baseUrl = baseUrl;
        saveConfig(config);
        process.stderr.write(`\nSigned in. Wrote API key to ${configPath()}\n`);
        return;
      }

      if ("error" in body) {
        switch (body.error) {
          case "authorization_pending":
            continue;
          case "slow_down":
            intervalSeconds = body.interval ?? intervalSeconds + 5;
            continue;
          case "access_denied":
            fail(`login denied.`, EXIT.NETWORK, false);
          case "expired_token":
            fail(
              `login code expired. Run 'makespdf login' again to get a fresh one.`,
              EXIT.NETWORK,
              false,
            );
          case "invalid_device_code":
            fail(`server rejected the device code.`, EXIT.API, false);
          default:
            fail(`login failed: ${body.error}`, EXIT.API, false);
        }
      }

      // Non-ok response with no recognizable error — bail out.
      fail(
        `unexpected ${pollRes.status} from ${baseUrl}/api/v1/device/token`,
        EXIT.API,
        false,
      );
    }
  },
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
