import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, resolveApiKey, resolveBaseUrl, saveConfig } from "./config.js";

describe("config", () => {
  let tmp: string;
  let path: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "makespdf-cli-test-"));
    path = join(tmp, "config.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty config when file is missing", () => {
    expect(loadConfig(path)).toEqual({});
  });

  it("returns empty config when file is malformed", () => {
    saveConfig({ apiKey: "abc" }, path);
    writeFileSync(path, "not-json");
    expect(loadConfig(path)).toEqual({});
  });

  it("roundtrips saved config", () => {
    saveConfig({ apiKey: "abc123", baseUrl: "http://localhost:8788" }, path);
    expect(loadConfig(path)).toEqual({
      apiKey: "abc123",
      baseUrl: "http://localhost:8788",
    });
  });

  it("writes config with 0600 mode on posix", () => {
    if (process.platform === "win32") return;
    saveConfig({ apiKey: "abc" }, path);
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("includes a trailing newline for POSIX tools", () => {
    saveConfig({ apiKey: "abc" }, path);
    expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
  });

  describe("resolveApiKey", () => {
    const originalEnv = process.env.MAKESPDF_API_KEY;
    afterEach(() => {
      if (originalEnv === undefined) delete process.env.MAKESPDF_API_KEY;
      else process.env.MAKESPDF_API_KEY = originalEnv;
    });

    it("prefers explicit flag over env and config", () => {
      process.env.MAKESPDF_API_KEY = "env";
      expect(resolveApiKey("flag", { apiKey: "cfg" })).toBe("flag");
    });

    it("prefers env over config", () => {
      process.env.MAKESPDF_API_KEY = "env";
      expect(resolveApiKey(undefined, { apiKey: "cfg" })).toBe("env");
    });

    it("falls back to config", () => {
      delete process.env.MAKESPDF_API_KEY;
      expect(resolveApiKey(undefined, { apiKey: "cfg" })).toBe("cfg");
    });

    it("returns undefined when nothing is set", () => {
      delete process.env.MAKESPDF_API_KEY;
      expect(resolveApiKey(undefined, {})).toBeUndefined();
    });
  });

  describe("resolveBaseUrl", () => {
    const originalEnv = process.env.MAKESPDF_BASE_URL;
    afterEach(() => {
      if (originalEnv === undefined) delete process.env.MAKESPDF_BASE_URL;
      else process.env.MAKESPDF_BASE_URL = originalEnv;
    });

    it("defaults to production URL", () => {
      delete process.env.MAKESPDF_BASE_URL;
      expect(resolveBaseUrl(undefined, {})).toBe("https://makespdf.com");
    });

    it("prefers explicit flag", () => {
      process.env.MAKESPDF_BASE_URL = "http://env";
      expect(
        resolveBaseUrl("http://flag", { baseUrl: "http://cfg" }),
      ).toBe("http://flag");
    });

    it("uses env when no flag", () => {
      process.env.MAKESPDF_BASE_URL = "http://env";
      expect(resolveBaseUrl(undefined, { baseUrl: "http://cfg" })).toBe("http://env");
    });
  });
});
