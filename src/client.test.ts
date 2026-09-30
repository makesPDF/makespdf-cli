import { describe, expect, it, vi } from "vitest";
import { CLIENT_HEADER, CLIENT_NAME } from "./client-info.js";
import { ApiClient, ApiError, NetworkError } from "./client.js";

function makeFetch(response: Partial<Response>): typeof fetch {
  return vi.fn().mockResolvedValue(response as Response) as unknown as typeof fetch;
}

describe("ApiClient", () => {
  it("sends Authorization header and JSON body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: "http://localhost:8788",
      apiKey: "secret",
      fetchImpl,
    });

    await client.post("/api/v1/md", { body: { markdown: "# hi" } });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("http://localhost:8788/api/v1/md");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers[CLIENT_HEADER]).toBe(CLIENT_NAME);
    expect(init.body).toBe(JSON.stringify({ markdown: "# hi" }));
  });

  it("strips trailing slash from baseUrl", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: "http://localhost:8788/",
      apiKey: "secret",
      fetchImpl,
    });
    await client.post("/api/v1/md", { body: {} });
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("http://localhost:8788/api/v1/md");
  });

  it("returns Uint8Array for binary responses", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const fetchImpl = makeFetch({
      ok: true,
      status: 200,
      arrayBuffer: async () => pdfBytes.buffer,
    });
    const client = new ApiClient({
      baseUrl: "http://localhost",
      apiKey: "k",
      fetchImpl,
    });
    const result = await client.post<Uint8Array>("/api/v1/md", { body: {} });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("parses JSON responses when expect=json", async () => {
    const fetchImpl = makeFetch({
      ok: true,
      status: 200,
      json: async () => ({ valid: true, issues: [], summary: { errors: 0, warnings: 0 } }),
    });
    const client = new ApiClient({ baseUrl: "http://l", apiKey: "k", fetchImpl });
    const result = await client.post<{ valid: boolean }>("/api/v1/md/validate", {
      body: { markdown: "# ok" },
      expect: "json",
    });
    expect(result.valid).toBe(true);
  });

  it("sends Accept: application/json header when expect=json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "http://l", apiKey: "k", fetchImpl });
    await client.post("/x", { body: {}, expect: "json" });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(init.headers.Accept).toBe("application/json");
  });

  it("throws ApiError on non-2xx", async () => {
    const fetchImpl = makeFetch({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });
    const client = new ApiClient({ baseUrl: "http://l", apiKey: "k", fetchImpl });
    await expect(client.post("/x", { body: {} })).rejects.toThrowError(ApiError);
  });

  it("wraps fetch exceptions as NetworkError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "http://l", apiKey: "k", fetchImpl });
    await expect(client.post("/x", { body: {} })).rejects.toThrowError(NetworkError);
  });
});
