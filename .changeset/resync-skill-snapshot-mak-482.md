---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` snapshot from the monorepo
(`lecstor/makespdf` `skills/pdf-template-author.md` on `integration`; git blob
`99c3fead`, sha256 `03ef35c5…`). The snapshot now carries the SEP-2640
`SKILL.md` frontmatter from MAK-482, so `makespdf skill` starts its output
with a YAML block (`name: pdf-template-author` and a quoted `description`).
`makespdf skill > SKILL.md` therefore produces a valid standard skill file.
It also picks up the one-line chained-filter example added upstream by
MAK-508.

No code changes — `scripts/bake-skill.mjs` picks the markdown up at build
time, and the CI smoke test `cmp`s the baked `makespdf skill` output against
the file byte for byte.
