import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
