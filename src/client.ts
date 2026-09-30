/**
 * Thin fetch wrapper for the makesPDF HTTP API.
 *
 * Responsibilities:
 *   - Attach the Authorization and client-identity headers.
 *   - Turn non-2xx responses into typed `ApiError`s (exit-code 2).
 *   - Turn network/DNS failures into `NetworkError`s (exit-code 3).
 *   - Return the response body typed as either bytes or JSON.
 *
 * Deliberately free of retries, backoff, caching, and progress indicators —
 * the CLI is a thin pipe to the API.
 */

import { clientHeaders } from "./client-info.js";

export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    readonly status: number,
    readonly bodyText: string,
    readonly url: string,
  ) {
    super(`API error ${status} at ${url}: ${bodyText.slice(0, 500)}`);
  }
}

export class NetworkError extends Error {
  override readonly name = "NetworkError";
  constructor(
    message: string,
    readonly url: string,
    override readonly cause?: unknown,
  ) {
    super(`network error at ${url}: ${message}`);
  }
}

export class AuthError extends Error {
  override readonly name = "AuthError";
  constructor(message: string) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Optional fetch override for tests. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

export interface PostOptions {
  /** Request body, serialized as JSON. */
  body: unknown;
  /**
   * Response format:
   *   - "bytes" (default): returns Uint8Array of the raw body — used for PDFs.
   *   - "json":            parses response JSON and returns it.
   */
  expect?: "bytes" | "json";
  /**
   * Called with the raw Response before the body is read, so callers can
   * inspect headers (e.g. billing) without changing the return shape.
   */
  onResponse?: (response: Response) => void;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  async post<T = unknown>(path: string, opts: PostOptions): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const expect = opts.expect ?? "bytes";
    const headers: Record<string, string> = {
      ...clientHeaders(),
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (expect === "json") headers.Accept = "application/json";

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(opts.body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NetworkError(message, url, err);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ApiError(response.status, text, url);
    }

    opts.onResponse?.(response);

    if (expect === "json") {
      return (await response.json()) as T;
    }
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf) as unknown as T;
  }
}
