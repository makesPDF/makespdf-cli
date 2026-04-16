---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` skill file. `makespdf skill`
now emits the current canonical version, including the "Choosing an
endpoint" decision tree, the updated `/preview` vs `/render` guidance, the
`each()` / `when()` inline-text patterns, document recipes (statement, CV,
letter), dense-table advice, post-render verification checklist, and the
device-authorization flow section. No code changes — `scripts/bake-skill.mjs`
picks up the new markdown at build time.
