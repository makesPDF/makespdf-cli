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

# 4. Iterate on a template (free, watermarked draft output).
makespdf validate template.js            # cheap pre-flight check
makespdf preview template.js --data data.json -o draft.pdf

# 5. Save the template, then render it with real data (billed).
curl -X POST https://makespdf.com/api/v1/templates \
  -H "Authorization: Bearer $MAKESPDF_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"invoice\",\"dsl\":$(jq -Rs . < template.js)}"
# → { "templateId": "…uuid…", … }
makespdf render <templateId> --data data.json -o invoice.pdf

# 6. Drop the AI skill into your editor for template-authoring help.
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

### `makespdf render <templateId> [options]`
Render a saved template by ID via `POST /api/v1/render`. The production / publish counterpart to `preview`: same deterministic pipeline, but reads the DSL from a template you've already saved via `POST /api/v1/templates` and **bills 1 credit per 10 pages** on success. No watermark, no preview-filler substitution.

| Flag | Description |
|---|---|
| `-o, --out <path>` | Write PDF to this file. |
| `--data <path\|json>` | Path to a JSON data file **or** an inline `'{"...": "..."}'`. If omitted, the template's `sampleData` is used. |
| `--title <string>` | Document title used in PDF metadata. |
| `--json` | Return JSON metadata instead of binary PDF. |

Billing headers (`X-Credits-Deducted`, `X-Credits-Remaining`) from the response are written to stderr as `credits: deducted N, remaining M`. Failures (400/402/404/429) never deduct credits and the API error body is surfaced as an error.

Typical flow — iterate for free, then save + render for billed output:
```bash
makespdf preview template.js --data data.json -o draft.pdf   # free, watermarked
# Save it (no CLI wrapper yet):
curl -X POST https://makespdf.com/api/v1/templates \
  -H "Authorization: Bearer $MAKESPDF_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"invoice\",\"dsl\":$(jq -Rs . < template.js)}"
makespdf render <templateId> --data data.json -o invoice.pdf  # billed, clean PDF
```

### `makespdf validate <file> [options]`
Pre-flight check. Catches unknown tags, invalid nesting, missing row widths, and PDF/UA-1 accessibility issues (missing alt text, heading hierarchy). **Does not render.**

- `.md` files → checked via `/api/v1/md/validate`
- `.json`, `.js`, `.ts`, `.mjs` → checked via `/api/v1/preview/validate`

Exits with code `1` if any errors are found (warnings do not fail).

| Flag | Description |
|---|---|
| `--json` | Emit the validator's raw JSON response. |

### `makespdf login`
Browser-based sign-in via the OAuth 2.0 device authorization flow ([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)) — the same pattern GitHub CLI and `gcloud auth` use. Requests a short user code from the server, opens `makespdf.com/device?code=...` in your browser, and polls until you approve. No local HTTP listener, no firewall prompts. Works on headless machines too — pass `--no-browser` and open the URL on any device. The resulting API key is saved to `~/.config/makespdf/config.json` with mode `0600`.

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

## Releasing

Releases are published from GitHub Actions via **npm OIDC trusted publishing** — no `NPM_TOKEN` is stored anywhere. The publish step exchanges a short-lived GitHub OIDC token for an npm publish token at the moment of publish, and stamps the package with a SLSA provenance attestation (the "Built and signed on GitHub Actions" badge on npmjs.com).

Version bumping and changelog generation are driven by [**changesets**](https://github.com/changesets/changesets). Every user-visible change lands on main with a changeset file describing the bump type and a short changelog note. When you're ready to release, `pnpm release` consumes the pending changesets, bumps `package.json`, commits, tags, and pushes — the tag push triggers the publish workflow.

### Day-to-day: describe each change

```bash
# After making a user-visible change, run:
pnpm changeset
# Interactive — pick patch/minor/major and type the changelog note.
# Commit the .changeset/<name>.md file along with your code change.
```

### Cutting a release

```bash
pnpm release
```

What it does:

1. **Guards** — refuses if the tree is dirty, you're not on main, you're behind origin, or there are no pending changesets.
2. **Safety gate** — runs `pnpm typecheck`, `pnpm test`, and `pnpm build` before touching versions.
3. **Bumps versions** — `changeset version` consumes the pending changesets, updates `package.json`, rewrites `CHANGELOG.md`.
4. **Commits** — creates a `Version X.Y.Z` commit (only `package.json`, `CHANGELOG.md`, `pnpm-lock.yaml`, `.changeset/*`).
5. **Prompts for confirmation** — last abort window. Everything up to this point is local-only, reversible with `git reset --hard HEAD^`.
6. **Pushes + tags** — pushes `main`, creates an annotated `vX.Y.Z` tag (via `changeset tag`), pushes tags.

The tag push triggers `.github/workflows/release.yml`, which runs `pnpm exec changeset publish --no-git-tag` inside an OIDC-authorized job. No secrets involved.

### If the release workflow fails

The tag is pushed but publish failed before (or during) the OIDC exchange. Fix, re-tag, re-push — **do not** re-run `pnpm release`, because the pending changesets have already been consumed:

```bash
# 1. Delete the tag locally and on the remote
git tag -d v0.1.1
git push origin :refs/tags/v0.1.1

# 2. Fix the issue, commit on main
git commit -am "fix(ci): ..."
git push origin main

# 3. Re-tag HEAD with the SAME version number and re-push
git tag -a v0.1.1 -m "Version 0.1.1"
git push origin v0.1.1
```

### Bootstrap note

Trusted publishing cannot bootstrap a new package name — the first `v0.1.0` must be published manually from a local machine with `npm publish --access public`. After that, the npmjs.com **Settings → Trusted Publisher** panel is configured with:

- Organization: `makesPDF`
- Repository: `makespdf-cli`
- Workflow filename: `release.yml` (basename only — not a full path)
- Environment: (blank)

Every subsequent release goes through the workflow.

## License

MIT © makesPDF
