import { describe, expect, it } from "vitest";
import { startLoopbackServer } from "./loopback-server.js";

async function get(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

describe("loopback server", () => {
  it("resolves with token when state matches", async () => {
    const server = await startLoopbackServer({ state: "abc123" });
    const waiter = server.waitForToken(5_000);
    const res = await get(
      `http://127.0.0.1:${server.port}/callback?state=abc123&token=tok_xyz`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain("Signed in");
    await expect(waiter).resolves.toBe("tok_xyz");
  });

  it("rejects mismatched state (keeps listening)", async () => {
    const server = await startLoopbackServer({ state: "abc" });
    const bad = await get(
      `http://127.0.0.1:${server.port}/callback?state=wrong&token=t`,
    );
    expect(bad.status).toBe(400);
    // Subsequent good request still resolves.
    const waiter = server.waitForToken(5_000);
    const good = await get(
      `http://127.0.0.1:${server.port}/callback?state=abc&token=good`,
    );
    expect(good.status).toBe(200);
    await expect(waiter).resolves.toBe("good");
  });

  it("returns 404 on other paths", async () => {
    const server = await startLoopbackServer({ state: "s" });
    const res = await get(`http://127.0.0.1:${server.port}/other`);
    expect(res.status).toBe(404);
    server.close();
  });

  it("times out when no callback arrives", async () => {
    const server = await startLoopbackServer({ state: "s" });
    await expect(server.waitForToken(50)).rejects.toThrow(/timed out/);
  });

  it("picks a port within the requested range", async () => {
    const server = await startLoopbackServer({
      state: "s",
      portRange: [40000, 49999],
    });
    expect(server.port).toBeGreaterThanOrEqual(40000);
    expect(server.port).toBeLessThanOrEqual(49999);
    server.close();
  });
});
