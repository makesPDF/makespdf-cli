import { defineCommand } from "citty";
import { clientFromArgs } from "../auth-helpers.js";
import { ApiError, NetworkError } from "../client.js";
import { EXIT, fail } from "../errors.js";
import { readText, writeBinaryOutput } from "../io.js";

interface MdJsonResponse {
  pdfBase64?: string;
  [key: string]: unknown;
}

export const mdCommand = defineCommand({
  meta: {
    name: "md",
    description: "Render a Markdown file (or stdin, with '-') to PDF via the makesPDF API.",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to a markdown file, or '-' to read from stdin.",
      required: true,
    },
    out: {
      type: "string",
      description: "Write PDF to this file (default: stdout).",
      alias: "o",
    },
    "page-size": {
      type: "string",
      description: "A3 | A4 | A5 | Letter | Legal (default A4).",
    },
    "font-family": {
      type: "string",
      description: "Inter | NotoSans (default Inter).",
    },
    "font-size": {
      type: "string",
      description: "Body font size in points (6-24).",
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
      description: "Override API key (else MAKESPDF_API_KEY or config file).",
    },
    "base-url": {
      type: "string",
      description: "Override the makesPDF base URL.",
    },
  },
  async run({ args }) {
    const client = clientFromArgs(args);
    const markdown = await readText(args.file);

    const options: Record<string, unknown> = {};
    if (args["page-size"]) options.pageSize = args["page-size"];
    if (args["font-family"]) options.fontFamily = args["font-family"];
    if (args["font-size"]) {
      const n = Number.parseFloat(args["font-size"]);
      if (Number.isFinite(n)) options.fontSize = n;
    }
    if (args.title) options.title = args.title;

    const body: Record<string, unknown> = { markdown };
    if (Object.keys(options).length > 0) body.options = options;

    try {
      if (args.json) {
        const json = await client.post<MdJsonResponse>("/api/v1/md", {
          body,
          expect: "json",
        });
        process.stdout.write(JSON.stringify(json, null, 2) + "\n");
        return;
      }
      const bytes = await client.post<Uint8Array>("/api/v1/md", { body });
      writeBinaryOutput(bytes, args.out || undefined);
    } catch (err) {
      handleApiError(err, args.json === true);
    }
  },
});

export function handleApiError(err: unknown, json: boolean): never {
  if (err instanceof ApiError) {
    fail(`${err.status}: ${err.bodyText.slice(0, 500)}`, EXIT.API, json);
  }
  if (err instanceof NetworkError) {
    fail(err.message, EXIT.NETWORK, json);
  }
  if (err instanceof Error) {
    fail(err.message, EXIT.USER, json);
  }
  fail(String(err), EXIT.USER, json);
}
