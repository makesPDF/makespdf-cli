import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Return the path to the config file, honoring XDG_CONFIG_HOME when set.
 * Layout:
 *   Linux/macOS:  ~/.config/makespdf/config.json
 *   Windows:      %APPDATA%/makespdf/config.json (falls back to HOME)
 */
export function configPath(): string {
  if (process.env.MAKESPDF_CONFIG) return process.env.MAKESPDF_CONFIG;

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "makespdf", "config.json");

  if (platform() === "win32") {
    const appData = process.env.APPDATA;
    if (appData) return join(appData, "makespdf", "config.json");
  }

  return join(homedir(), ".config", "makespdf", "config.json");
}

export function loadConfig(path: string = configPath()): CliConfig {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CliConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: CliConfig, path: string = configPath()): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  // Best-effort — chmod is a no-op on Windows.
  try {
    chmodSync(path, 0o600);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the API key from, in order:
 *   1. explicit `apiKey` argument (e.g. from --api-key flag)
 *   2. MAKESPDF_API_KEY env var
 *   3. config file
 */
export function resolveApiKey(
  explicit: string | undefined,
  config: CliConfig = loadConfig(),
): string | undefined {
  return explicit ?? process.env.MAKESPDF_API_KEY ?? config.apiKey;
}

/**
 * Resolve the base URL from, in order:
 *   1. explicit `baseUrl` argument (e.g. from --base-url flag)
 *   2. MAKESPDF_BASE_URL env var
 *   3. config file
 *   4. default production URL
 */
export function resolveBaseUrl(
  explicit: string | undefined,
  config: CliConfig = loadConfig(),
): string {
  return (
    explicit ??
    process.env.MAKESPDF_BASE_URL ??
    config.baseUrl ??
    "https://makespdf.com"
  );
}
