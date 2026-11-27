---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` snapshot from the monorepo
(`lecstor/makespdf` `skills/pdf-template-author.md` on `integration`; git blob
`ab385c42`, sha256 `0b597b95…`). The snapshot now carries the SEP-2640
`SKILL.md` frontmatter from MAK-482, so `makespdf skill` starts its output
with a YAML block (`name: pdf-template-author` and a quoted `description`).
`makespdf skill > SKILL.md` therefore produces a valid standard skill file.
The rest of the file is unchanged.

No code changes — `scripts/bake-skill.mjs` picks the markdown up at build
time, and the CI smoke test `cmp`s the baked `makespdf skill` output against
the file byte for byte.
