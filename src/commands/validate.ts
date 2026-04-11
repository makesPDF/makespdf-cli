import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { clientFromArgs } from "../auth-helpers.js";
import { EXIT, fail } from "../errors.js";
import { handleApiError } from "./md.js";

interface ValidateIssue {
  severity: "error" | "warning";
  message: string;
  path?: string;
  rule?: string;
}

interface ValidateResponse {
  valid: boolean;
  issues: ValidateIssue[];
  summary: { errors: number; warnings: number };
}

const DSL_EXTS = new Set([".js", ".mjs", ".ts", ".mts", ".cjs"]);

export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description:
      "Check a markdown file or template for structural and accessibility issues. Does not render. Exits 1 if any errors are found.",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to a .md file (markdown validator) or .js/.ts/.json template file.",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Emit the validator's raw JSON response.",
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
    const ext = extname(args.file).toLowerCase();

    if (!existsSync(args.file)) {
      fail(`file not found: ${args.file}`, EXIT.USER, args.json === true);
    }
    const source = readFileSync(args.file, "utf8");

    let path: string;
    let body: Record<string, unknown>;

    if (ext === ".md" || ext === ".markdown") {
      path = "/api/v1/md/validate";
      body = { markdown: source };
    } else if (ext === ".json") {
      path = "/api/v1/preview/validate";
      try {
        body = { document: JSON.parse(source) };
      } catch (err) {
        fail(
          `failed to parse ${args.file} as JSON: ${err instanceof Error ? err.message : String(err)}`,
          EXIT.USER,
          args.json === true,
        );
      }
    } else if (DSL_EXTS.has(ext)) {
      path = "/api/v1/preview/validate";
      body = { dsl: source };
    } else {
      fail(
        `unknown file extension "${ext}"; expected .md, .json, .js, .ts, or .mjs`,
        EXIT.USER,
        args.json === true,
      );
    }

    let result: ValidateResponse;
    try {
      result = await client.post<ValidateResponse>(path, { body, expect: "json" });
    } catch (err) {
      handleApiError(err, args.json === true);
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      printHumanReadable(result, args.file);
    }

    // Exit 1 only on errors — warnings-only still succeed.
    if (result.summary.errors > 0) process.exit(EXIT.USER);
  },
});

function printHumanReadable(result: ValidateResponse, file: string): void {
  if (result.valid && result.issues.length === 0) {
    process.stdout.write(`${file}: ok\n`);
    return;
  }
  for (const issue of result.issues) {
    const marker = issue.severity === "error" ? "error" : "warning";
    const location = issue.path ? ` [${issue.path}]` : "";
    const rule = issue.rule ? ` (${issue.rule})` : "";
    process.stdout.write(`${file}: ${marker}${location}: ${issue.message}${rule}\n`);
  }
  process.stdout.write(
    `\n${result.summary.errors} error${result.summary.errors === 1 ? "" : "s"}, ` +
      `${result.summary.warnings} warning${result.summary.warnings === 1 ? "" : "s"}\n`,
  );
}
