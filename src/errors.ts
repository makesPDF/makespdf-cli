/**
 * Exit code convention:
 *   0 — success
 *   1 — user error (bad args, missing file, validation failed)
 *   2 — API error (non-2xx response from makesPDF)
 *   3 — network/auth error (DNS/connection failures, missing API key)
 */
export const EXIT = {
  OK: 0,
  USER: 1,
  API: 2,
  NETWORK: 3,
} as const;

export class UserError extends Error {
  override readonly name = "UserError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Print an error to stderr and exit with the given code. Respects --json
 * output mode so agents can parse the failure.
 */
export function fail(message: string, code: number, json: boolean): never {
  if (json) {
    process.stderr.write(JSON.stringify({ ok: false, error: message }) + "\n");
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
  process.exit(code);
}
