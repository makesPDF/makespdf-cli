---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` snapshot from the monorepo
(`lecstor/makespdf` `skills/pdf-template-author.md` at `main`, 175feb5a).
`makespdf skill` now prints the current skill instead of the 2026-11-05
snapshot:

- **MCP**: the tool table lists **twelve** tools, adding
  `get_render_download_url` (`GET /api/v1/artifacts/:id/pdf`, free). Billed
  renders document the `downloadUrl` they return — no credential of its own,
  15-minute expiry — and how to refresh it from the render's `artifactId`
  (artifacts are kept 7 days). The setup section also documents OAuth sign-in
  (VS Code 1.106+, Cursor) alongside the Bearer API key.
- **`list(opts, items)`**: tagged `/L` `/LI` `/Lbl` `/LBody` lists, including
  ordered, nested and task-list forms.
- **Row spans**: `rowspan` on `col({ grid })` rows, with the grid requirement
  and validator codes documented.
- **Factur-X / ZUGFeRD**: `options.facturX` on `/render`, the profile and
  relationship rules, and what `/preview` reports instead.
- **Tables and headings**: align a column without sizing it (`null` in the
  width slot), and keep a lead-in paragraph with its heading via
  `"not-last": true`.
- **Charts**: the scatter `y` example now uses the `[{ key, label }]` shape
  `chart()` accepts, and `colors` can be a whole-value data binding.
- **Links**: only `http`, `https`, `mailto` and internal `#anchor` targets
  stay clickable; other schemes render as plain text with a
  `link-scheme-blocked` warning.

No code changes — `scripts/bake-skill.mjs` picks the new markdown up at build
time, and the CI smoke test compares the baked output to the file byte for
byte.
