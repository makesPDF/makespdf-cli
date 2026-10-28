---
"@makespdf/cli": patch
---

Refresh the baked-in `pdf-template-author.md` snapshot from the monorepo
after the MAK-305 content corrections (lecstor/makespdf#379). Three
corrections to what `makespdf skill` prints:

- **§ Script shape** no longer claims the DSL subset is `const`-only with no
  `if` statements. It reads "only `const`/`let` declarations at the top
  level — no loops, no `switch`, no bare identifiers", which is what the
  executor actually enforces and what the DSL Traps section already said.
- **Step 6** uses `template.js` in its `preview` / `validate` examples. The
  old `template.dsl` was rejected by both commands (`unknown template
  extension ".dsl"`).
- The `lang` bullet links `/skills/pdf-fonts.md` like the file's other
  references.

Also carries the `translate`-before-`rotate` note from MAK-245, which had
not reached the snapshot yet. No code changes — `scripts/bake-skill.mjs`
picks the new markdown up at build time.
