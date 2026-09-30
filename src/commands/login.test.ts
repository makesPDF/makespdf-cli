import { runCommand } from "citty";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_HEADER, CLIENT_NAME } from "../client-info.js";
import { loginCommand } from "./login.js";

/**
 * The device-flow login talks to the API with raw `fetch` calls (it has no
 * API key yet, so it cannot use ApiClient), which makes it the easiest place
 * for the client-identity header to drift. This drives the command through
 * citty the same way the binary does, against a stubbed fetch.
 */
describe("login command", () => {
  let dir: string;
  let configFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "makespdf-login-test-"));
    configFile = join(dir, "config.json");
    process.env.MAKESPDF_CONFIG = configFile;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MAKESPDF_CONFIG;
    rmSync(dir, { recursive: true, force: true });
  });

  it("sends the client header on every device-flow request", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith("/api/v1/device/code")) {
          return new Response(
            JSON.stringify({
              device_code: "dev-1",
              user_code: "ABCD-1234",
              verification_uri: "http://test.local/device",
              verification_uri_complete: "http://test.local/device?code=ABCD-1234",
              expires_in: 60,
              interval: 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ access_token: "tok-1", token_type: "bearer" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await runCommand(loginCommand, {
      rawArgs: ["--base-url", "http://test.local", "--no-browser"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual([
      "http://test.local/api/v1/device/code",
      "http://test.local/api/v1/device/token",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      const headers = init?.headers as Record<string, string>;
      expect(headers[CLIENT_HEADER]).toBe(CLIENT_NAME);
      expect(headers["Content-Type"]).toBe("application/json");
    }

    // Sanity: the flow completed and persisted the token.
    expect(JSON.parse(readFileSync(configFile, "utf8"))).toMatchObject({
      apiKey: "tok-1",
      baseUrl: "http://test.local",
    });
  });
});
