import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import {
  CLIENT_HEADER,
  CLIENT_KIND,
  CLIENT_NAME,
  CLIENT_VERSION,
  clientHeaders,
} from "./client-info.js";

describe("client identity", () => {
  it("identifies as the plain `cli/<package version>` kind", () => {
    expect(CLIENT_KIND).toBe("cli");
    expect(CLIENT_VERSION).toBe(pkg.version);
    expect(CLIENT_NAME).toBe(`cli/${pkg.version}`);
  });

  it("carries the identity in the shared request headers", () => {
    const headers = clientHeaders();
    expect(headers[CLIENT_HEADER]).toBe(CLIENT_NAME);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["User-Agent"]).toBe("@makespdf/cli");
  });
});
