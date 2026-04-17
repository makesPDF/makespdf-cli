---
"@makespdf/cli": minor
---

Add `makespdf render <templateId>` subcommand for the rewritten `POST /api/v1/render { templateId, data }` contract (draft/publish split stage 3). Companion to the existing `preview` subcommand: same flags (`--data`, `-o`, `--title`, `--json`), but renders a template the caller has saved via `POST /api/v1/templates` and deducts credits (1 per 10 pages) on success. `X-Credits-Deducted` / `X-Credits-Remaining` headers are echoed to stderr so users see what each render cost. 4xx bodies (400, 402, 404, 429) are surfaced as-is via the shared error handler. Missing or expired tokens route through the existing device-flow login UX.
