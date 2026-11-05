import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { main } from "./main.js";

describe("makespdf command", () => {
  it("reports the package version", () => {
    expect((main.meta as { version?: string }).version).toBe(pkg.version);
  });
});
