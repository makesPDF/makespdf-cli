import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { clientFromArgs } from "../auth-helpers.js";
import { EXIT, fail } from "../errors.js";
import { readText, writeBinaryOutput } from "../io.js";
import { handleApiError } from "./md.js";

const DSL_EXTS = new Set([".js", ".mjs", ".ts", ".mts", ".cjs"]);
const JSON_EXTS = new Set([".json"]);

export const previewCommand = defineCommand({
  meta: {
    name: "preview",
    description:
      "Render a DSL script (.js/.ts/.mjs) or DocumentDefinition JSON template to PDF. Use --data to supply variables.",
  },
  args: {
    template: {
      type: "positional",
      description: "Path to template file. Extension determines mode (.js/.ts/.mjs → DSL, .json → document).",
      required: true,
    },
    data: {
      type: "string",
      description:
        "Data for {{variable}} substitution. Either a path to a .json file, or a JSON string starting with '{'. If omitted, the DSL script's sampleData is used.",
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

    const ext = extname(args.template).toLowerCase();
    const templateSource = await readText(args.template);

    const body: Record<string, unknown> = {};
    if (DSL_EXTS.has(ext)) {
      body.dsl = templateSource;
    } else if (JSON_EXTS.has(ext)) {
      try {
        body.document = JSON.parse(templateSource);
      } catch (err) {
        fail(
          `failed to parse ${args.template} as JSON: ${err instanceof Error ? err.message : String(err)}`,
          EXIT.USER,
          args.json === true,
        );
      }
    } else {
      fail(
        `unknown template extension "${ext}"; expected one of ${[...DSL_EXTS, ...JSON_EXTS].join(", ")}`,
        EXIT.USER,
        args.json === true,
      );
    }

    if (args.data) {
      body.data = parseDataArg(args.data, args.json === true);
    }

    if (args.title) {
      body.options = { title: args.title };
    }

    try {
      if (args.json) {
        const json = await client.post<unknown>("/api/v1/preview", {
          body,
          expect: "json",
        });
        process.stdout.write(JSON.stringify(json, null, 2) + "\n");
        return;
      }
      const bytes = await client.post<Uint8Array>("/api/v1/preview", { body });
      writeBinaryOutput(bytes, args.out || undefined);
    } catch (err) {
      handleApiError(err, args.json === true);
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
