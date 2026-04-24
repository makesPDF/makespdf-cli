# @makespdf/cli

## 0.2.0

### Minor Changes

- a9f654a: Add `makespdf render <templateId>` subcommand for the rewritten `POST /api/v1/render { templateId, data }` contract (draft/publish split stage 3). Companion to the existing `preview` subcommand: same flags (`--data`, `-o`, `--title`, `--json`), but renders a template the caller has saved via `POST /api/v1/templates` and deducts credits (1 per 10 pages) on success. `X-Credits-Deducted` / `X-Credits-Remaining` headers are echoed to stderr so users see what each render cost. 4xx bodies (400, 402, 404, 429) are surfaced as-is via the shared error handler. Missing or expired tokens route through the existing device-flow login UX.

### Patch Changes

- 735c769: Refresh the baked-in `pdf-template-author.md` skill file. `makespdf skill`
  now emits the current canonical version, including the "Choosing an
  endpoint" decision tree, the updated `/preview` vs `/render` guidance, the
  `each()` / `when()` inline-text patterns, document recipes (statement, CV,
  letter), dense-table advice, post-render verification checklist, and the
  device-authorization flow section. No code changes — `scripts/bake-skill.mjs`
  picks up the new markdown at build time.

## 0.1.0

### Minor Changes

Initial public release of `@makespdf/cli` — a thin command-line wrapper around the hosted [makesPDF](https://makespdf.com) REST API.

#### Commands

- **`makespdf md <file|->`** — Convert a Markdown file or stdin to PDF via `POST /api/v1/md`. Supports `--page-size`, `--font-family`, `--font-size`, `--title`, and `--json` for metadata-only responses. Binary PDF output goes to `-o <path>` or stdout (refuses to write binary to a TTY).
- **`makespdf preview <template> [options]`** — Render a template via `POST /api/v1/preview`. Auto-detects template type by extension: `.js`/`.ts`/`.mjs` are sent as a builder DSL script, `.json` as a pre-built DocumentDefinition. `--data` accepts a JSON file path or an inline JSON string; if omitted for DSL scripts, the script's `sampleData` is used as fallback.
- **`makespdf validate <file>`** — Pre-flight check for Markdown and templates via `POST /api/v1/{md,preview}/validate`. Catches unknown tags, invalid nesting, missing row widths, and PDF/UA-1 accessibility issues (missing alt text, heading hierarchy). Does not render. Exits with code `1` if errors are found; warnings do not fail.
- **`makespdf login`** — Browser-based sign-in using the OAuth 2.0 device authorization flow (RFC 8628). Requests a short user code, opens `makespdf.com/device` in the browser, and polls for approval. Works on headless hosts via `--no-browser`. No local HTTP listener, no port wrangling.
- **`makespdf auth <key>`** — Non-interactive auth for CI or headless environments. Writes a user-provided API key to the config file with mode `0600`.
- **`makespdf skill [-o <file>]`** — Prints a copy of the `pdf-template-author.md` skill file baked into the CLI binary at build time. Zero-network. Designed to be dropped into an AI assistant's context directory with one command.

#### Agent-first output

- `--json` flag on every command for deterministic, machine-readable output
- No spinners, no colors, no TTY decoration
- Stable exit codes: `0` success, `1` user error, `2` API error, `3` network/auth error
- Errors go to stderr; binary PDF output goes to stdout (or `-o <path>`)

#### Configuration

- API key resolution order: `--api-key` flag → `MAKESPDF_API_KEY` env var → `~/.config/makespdf/config.json`
- Base URL resolution order: `--base-url` flag → `MAKESPDF_BASE_URL` env var → config file → `https://makespdf.com`
- Config file location respects `$XDG_CONFIG_HOME` on Linux/macOS and `%APPDATA%` on Windows, overridable via `$MAKESPDF_CONFIG`

#### Distribution

- Single-file ESM bundle via `tsup`, targeting Node 20+
- Single runtime dependency: `citty` (~5 KB arg parser)
- Bundle size: ~37 KB
- Bootstrap-published manually from a local machine to claim the `@makespdf/cli` package name. All subsequent releases go through the GitHub Actions workflow using npm OIDC trusted publishing with SLSA provenance — no `NPM_TOKEN` stored anywhere.
