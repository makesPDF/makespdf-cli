import { defineCommand } from "citty";
import { hostname } from "node:os";
import { resolveBaseUrl, loadConfig, saveConfig, configPath } from "../config.js";
import { EXIT, fail } from "../errors.js";
import { openBrowser } from "../open-browser.js";
import { startLoopbackServer } from "../loopback-server.js";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description:
      "Sign in by opening a browser to makesPDF. A loopback HTTP listener receives the generated API key.",
  },
  args: {
    "base-url": {
      type: "string",
      description: "Override the makesPDF base URL (default: https://makespdf.com).",
    },
    timeout: {
      type: "string",
      description: "Seconds to wait for the browser callback (default 300).",
      default: "300",
    },
  },
  async run({ args }) {
    const config = loadConfig();
    const baseUrl = resolveBaseUrl(args["base-url"], config).replace(/\/+$/, "");
    const timeoutMs = Math.max(5, Number.parseInt(args.timeout, 10) || 300) * 1000;

    const server = await startLoopbackServer();
    const host = hostname();

    const url = new URL(`${baseUrl}/cli/auth`);
    url.searchParams.set("port", String(server.port));
    url.searchParams.set("state", server.state);
    url.searchParams.set("name", host);

    process.stderr.write(
      `Opening ${url.toString()}\n` +
        `Listening on http://127.0.0.1:${server.port}/callback\n` +
        `If your browser doesn't open automatically, paste the URL above.\n`,
    );

    try {
      await openBrowser(url.toString());
    } catch (err) {
      process.stderr.write(
        `(couldn't launch a browser automatically: ${err instanceof Error ? err.message : String(err)})\n`,
      );
    }

    let token: string;
    try {
      token = await server.waitForToken(timeoutMs);
    } catch (err) {
      server.close();
      const msg = err instanceof Error ? err.message : String(err);
      fail(`login failed: ${msg}`, EXIT.NETWORK, false);
    }

    config.apiKey = token;
    if (args["base-url"]) config.baseUrl = baseUrl;
    saveConfig(config);
    process.stderr.write(`Signed in. Wrote token to ${configPath()}\n`);
  },
});
