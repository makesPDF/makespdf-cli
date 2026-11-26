---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` snapshot from the monorepo
(`lecstor/makespdf` `skills/pdf-template-author.md` on `integration`, blob
`299af0e5`). `makespdf skill` now prints the corrected skill instead of the
snapshot taken from `175feb5a`:

- **Lists**: the accessibility note no longer tells authors to put the list
  in `doc({ tagged: true })` — in-flow output is tagged by default — and it
  names the `list()` call to use instead of rebuilding a list out of
  `r()` + `s("•")`.
- **Fillable form fields**: the same correction — there is nothing to opt
  into for tagging, so widgets land in the structure tree automatically
  rather than requiring a `tagged: true` option that does not exist.
- **Invoice line-item tables**: the canonical four-column example writes
  `null` in an omitted width slot instead of `undefined`. The DSL sandbox
  has no `undefined` binding, so the old wording produced a script that
  fails to run. The surrounding rule says so explicitly.
- **Rotated form fields**: new guidance that an `input` or `select` inside an
  absolutely positioned overlay supports whole quarter-turns only (a matching
  `/MK /R`); any other angle leaves the field static-only, while painted
  content and checkboxes are unaffected.

No code changes — `scripts/bake-skill.mjs` picks the markdown up at build
time, and the CI smoke test `cmp`s the baked `makespdf skill` output against
the file byte for byte.
