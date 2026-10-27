---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` skill file so `makespdf skill`
emits the current canonical version from the monorepo. Picks up the markdown
footer page-number options (`pageNumbers` / `pageNumberPosition` — MAK-226),
the `report_feedback` MCP tool, the script-shape rules (`each()` instead of
loops, literal `sampleData`), the `lang` document option, and the profile
default font guidance. No code changes — `scripts/bake-skill.mjs` picks the
new markdown up at build time.
