# @makespdf/cli

Command-line interface for **[makesPDF](https://makespdf.com)** — turn Markdown and template DSL scripts into PDF/A-2A + PDF/UA-1 dual-compliant PDFs from the terminal.

Thin wrapper around the hosted makesPDF API. No local rendering, no heavy dependencies, no colored output by default — designed to be scripted by CI, shell pipelines, and AI coding assistants.

## Install

```bash
npm install -g @makespdf/cli
# or run it ad-hoc without installing:
npx @makespdf/cli --help
```

Requires Node.js 20 or later.

## Quickstart

```bash
# 1. Authenticate (opens a browser).
makespdf login

# 2. Render a markdown file to PDF.
makespdf md report.md -o report.pdf

# 3. Or pipe markdown in and binary PDF out.
echo "# Hello" | makespdf md - > hello.pdf

# 4. Iterate on a template.
makespdf validate template.js            # cheap pre-flight check
makespdf preview template.js --data data.json -o out.pdf

# 5. Drop the AI skill into your editor for template-authoring help.
makespdf skill > .cursor/rules/makespdf.md
```

## Commands

### `makespdf md <file|-> [options]`
Convert a Markdown file (or stdin) to PDF.

| Flag | Description |
|---|---|
| `-o, --out <path>` | Write PDF to this file instead of stdout. |
| `--page-size <size>` | `A3`, `A4`, `A5`, `Letter`, `Legal` (default `A4`). |
| `--font-family <name>` | `Inter` (default) or `NotoSans`. |
| `--font-size <pt>` | Body font size, 6-24. |
| `--title <string>` | Document title used in PDF metadata. |
| `--json` | Return JSON metadata instead of binary PDF. |

### `makespdf preview <template> [options]`
Render a template to PDF. Template type is auto-detected by extension:
- `.js`, `.ts`, `.mjs` → builder DSL script (sent as `dsl`)
- `.json` → DocumentDefinition (sent as `document`)

| Flag | Description |
|---|---|
| `-o, --out <path>` | Write PDF to this file. |
| `--data <path\|json>` | Path to a JSON data file **or** an inline `'{"...": "..."}'`. If omitted, uses the DSL script's `sampleData`. |
| `--title <string>` | Document title. |
| `--json` | Return JSON metadata. |

### `makespdf validate <file> [options]`
Pre-flight check. Catches unknown tags, invalid nesting, missing row widths, and PDF/UA-1 accessibility issues (missing alt text, heading hierarchy). **Does not render.**

- `.md` files → checked via `/api/v1/md/validate`
- `.json`, `.js`, `.ts`, `.mjs` → checked via `/api/v1/preview/validate`

Exits with code `1` if any errors are found (warnings do not fail).

| Flag | Description |
|---|---|
| `--json` | Emit the validator's raw JSON response. |

### `makespdf login`
Browser-based sign-in. Opens a browser to `makespdf.com/cli/auth`, starts a local loopback HTTP listener on a random port in `40000-49999`, and receives an API key via callback. The key is saved to `~/.config/makespdf/config.json` with mode `0600`.

### `makespdf auth <key>`
Non-interactive auth for CI or headless environments. Paste an API key generated at [makespdf.com/settings/api-keys](https://makespdf.com/settings/api-keys). Same config file, same permissions.

### `makespdf skill [-o <file>]`
Print the `pdf-template-author` skill file to stdout (or write to a file). Drop it into your AI assistant's context directory so the assistant knows how to author templates for makesPDF.

```bash
makespdf skill > .cursor/rules/makespdf.md
makespdf skill > CLAUDE.md
makespdf skill | pbcopy
```

The skill is zero-network — the markdown is embedded in the CLI binary.

## Configuration

### Authentication resolution order
1. `--api-key <key>` flag
2. `MAKESPDF_API_KEY` environment variable
3. `~/.config/makespdf/config.json`

### Base URL resolution order
1. `--base-url <url>` flag
2. `MAKESPDF_BASE_URL` environment variable
3. Config file
4. `https://makespdf.com` (default)

Useful for pointing at a local dev server:
```bash
MAKESPDF_BASE_URL=http://localhost:8788 makespdf md report.md -o report.pdf
```

### Config file location
- Linux/macOS: `~/.config/makespdf/config.json` (respects `$XDG_CONFIG_HOME`)
- Windows: `%APPDATA%/makespdf/config.json`
- Override with `$MAKESPDF_CONFIG=/custom/path.json`

## Exit codes

The CLI uses stable exit codes so scripts and agents can react deterministically:

| Code | Meaning |
|---|---|
| `0` | Success (or validation passed with only warnings). |
| `1` | User error: bad arguments, missing file, validation failed with errors. |
| `2` | API error: the makesPDF server returned a non-2xx response. |
| `3` | Network or auth error: connection failure, missing API key, login timed out. |

## Output

- Binary output (PDFs) goes to **stdout** unless `-o <path>` is given. The CLI refuses to write binary to a TTY to avoid corrupting terminals.
- Errors and informational messages go to **stderr**.
- Pass `--json` on any command to get machine-readable output for agents. Errors under `--json` are emitted as `{"ok": false, "error": "..."}` on stderr.

## For AI assistants

Add the skill to your assistant's context and pair it with the CLI for a complete template-authoring loop:

```bash
# Drop the skill into Claude Code / Cursor / any assistant.
makespdf skill > .cursor/rules/makespdf.md

# Your assistant can then run:
makespdf validate my-template.js
makespdf preview my-template.js --data sample.json -o /tmp/preview.pdf
```

The CLI is intentionally agent-friendly:
- Deterministic `--json` output on every command.
- No spinners, no colors, no TTY decoration.
- Stable exit codes for reliable error handling.
- Single self-contained binary — no runtime filesystem reads of ancillary files.

## License

MIT © makesPDF
