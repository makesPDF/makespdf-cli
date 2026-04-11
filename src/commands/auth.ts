import { defineCommand } from "citty";
import { configPath, loadConfig, saveConfig } from "../config.js";
import { EXIT, fail } from "../errors.js";

export const authCommand = defineCommand({
  meta: {
    name: "auth",
    description:
      "Store an API key non-interactively (for CI / headless environments). Prefer `makespdf login` on machines with a browser.",
  },
  args: {
    key: {
      type: "positional",
      description: "API key from makespdf.com/settings/api-keys.",
      required: true,
    },
  },
  run({ args }) {
    const key = args.key?.trim();
    if (!key) fail("missing API key argument", EXIT.USER, false);
    const config = loadConfig();
    config.apiKey = key;
    saveConfig(config);
    process.stderr.write(`wrote API key to ${configPath()}\n`);
  },
});
