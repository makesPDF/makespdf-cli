import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { clientFromArgs } from "../auth-helpers.js";
import { EXIT, fail } from "../errors.js";
import { writeBinaryOutput } from "../io.js";
import { handleApiError } from "./md.js";

export const renderCommand = defineCommand({
  meta: {
    name: "render",
    description:
      "Render a saved template by ID via POST /api/v1/render. Billed — 1 credit per 10 pages.",
  },
  args: {
    templateId: {
      type: "positional",
      description: "UUID of a template previously saved via POST /api/v1/templates.",
      required: true,
    },
    data: {
      type: "string",
      description:
        "Data for {{variable}} substitution. Either a path to a .json file, or a JSON string starting with '{' or '['. If omitted, the template's sampleData is used.",
    },
    out: {
      type: "string",
      description: "Write PDF to this file (default: stdout).",
      alias: "o",
    },
    title: {
      type: "string",
      description: "Document title used in PDF metadata.",
    },
    json: {
      type: "boolean",
      description: "Return JSON metadata instead of binary PDF.",
    },
    "api-key": {
      type: "string",
      description: "Override API key.",
    },
    "base-url": {
      type: "string",
      description: "Override the makesPDF base URL.",
    },
  },
  async run({ args }) {
    const client = clientFromArgs(args);
    const jsonMode = args.json === true;

    const body: Record<string, unknown> = { templateId: args.templateId };

    if (args.data) {
      body.data = parseDataArg(args.data, jsonMode);
    }
    if (args.title) {
      body.options = { title: args.title };
    }

    const onResponse = (response: Response) => {
      const deducted = response.headers.get("x-credits-deducted");
      const remaining = response.headers.get("x-credits-remaining");
      if (deducted === null && remaining === null) return;
      const parts: string[] = [];
      if (deducted !== null) parts.push(`deducted ${deducted}`);
      if (remaining !== null) parts.push(`remaining ${remaining}`);
      process.stderr.write(`credits: ${parts.join(", ")}\n`);
    };

    try {
      if (jsonMode) {
        const json = await client.post<unknown>("/api/v1/render", {
          body,
          expect: "json",
          onResponse,
        });
        process.stdout.write(JSON.stringify(json, null, 2) + "\n");
        return;
      }
      const bytes = await client.post<Uint8Array>("/api/v1/render", {
        body,
        onResponse,
      });
      writeBinaryOutput(bytes, args.out || undefined);
    } catch (err) {
      handleApiError(err, jsonMode);
    }
  },
});

function parseDataArg(raw: string, json: boolean): unknown {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      fail(
        `failed to parse --data as inline JSON: ${err instanceof Error ? err.message : String(err)}`,
        EXIT.USER,
        json,
      );
    }
  }
  if (!existsSync(raw)) {
    fail(`--data file not found: ${raw}`, EXIT.USER, json);
  }
  try {
    return JSON.parse(readFileSync(raw, "utf8"));
  } catch (err) {
    fail(
      `failed to parse ${raw} as JSON: ${err instanceof Error ? err.message : String(err)}`,
      EXIT.USER,
      json,
    );
  }
}
