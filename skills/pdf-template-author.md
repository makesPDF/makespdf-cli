# PDF Template Author Skill

<!-- embedded:skip:start -->

> **Note to AI agents:** This document is served over HTTP at
> `https://makespdf.com/skills/pdf-template-author.md` (or
> `http://localhost:8788/skills/pdf-template-author.md` in dev). It is **not
> a local file.** If you need to re-fetch it, use a web fetch / HTTP tool —
> do **not** call your filesystem `Read` tool with `/skills/...`. Paths
> that begin with `/api/v1/`, `/device`, or `/skills/` in this document are
> URL paths relative to the makespdf origin, not filesystem paths.

<!-- embedded:skip:end -->

You are an expert PDF template designer. You create templates using a compact builder DSL that renders into professional PDF documents via the makespdf.com engine.

<!-- embedded:skip:start -->

## Companion skills

Read these alongside this file when the topic comes up — they are not
duplicated here in full. Each is fetchable from the makespdf origin at
the URL shown.

- **Authentication** —
  [`/skills/pdf-auth.md`](https://makespdf.com/skills/pdf-auth.md).
  How to obtain a Bearer token via the OAuth 2 device flow (RFC 8628).
  Read this if you don't already have a token. Covers the four-step
  flow, the do-not-do-this list (no asking for passwords, no clicking
  through `/device` yourself in browser MCP), and the 401 response
  shape that points back here.

- **Paying without an account (x402)** — wallet-owning agents can skip
  signup entirely and pay per call in USDC on Base mainnet. POST your
  request with no auth; the server replies HTTP 402 advertising the
  price (`$0.01` for `/api/v1/markdown`, `$0.02` for `/api/v1/render`
  with an inline `{ dsl, data }` body — `templateId` is account-only).
  Use `/api/v1/markdown`, not `/api/v1/md`, as the wallet entry point:
  the two run the same pipeline at the same price, but `/api/v1/md`
  also honours a free anonymous promo, so it may answer 200 or 401
  instead of the 402 you need. Sign an
  EIP-3009 `transferWithAuthorization` for the advertised amount,
  base64-encode the JSON `PaymentPayload`, and resend the same request
  with header `PAYMENT-SIGNATURE: <base64>`. Idempotent on retry within
  5 minutes. Full spec, V2 wire shape, and a real example body live in
  [`/llms.txt`](https://makespdf.com/llms.txt) under §Pay-per-call.

- **API endpoints** —
  [`/skills/pdf-api.md`](https://makespdf.com/skills/pdf-api.md).
  How to call `POST /api/v1/preview`, `POST /api/v1/render`, and
  `POST /api/v1/preview/validate` — request/response shapes, error
  codes, billing rules, and the `jq`-based shell pattern for sending
  multi-line DSL. Read after authoring a template.

- **Document recipes** —
  [`/skills/pdf-recipes.md`](https://makespdf.com/skills/pdf-recipes.md).
  Per-doc-type assembly skeletons (Invoice, Receipt, Quote, Statement,
  Letter, CV). Self-contained — each fits on a screen. Fetch only the
  one matching the user's request.

- **Custom fonts** —
  [`/skills/pdf-fonts.md`](https://makespdf.com/skills/pdf-fonts.md).
  Uploading TTF/OTF fonts to your account so any saved template can
  reference them by `font-family` name. Covers variable-font handling
  (rejected — use static instances), Google-Fonts → variant-slot mapping,
  and the `POST /api/v1/fonts` upload API. Read this before generating a
  template that uses anything other than `Inter`, `NotoSans`, `Cousine`,
  or `NotoSymbols2` (the embedded families).

- **Server-side integration** —
  [`/skills/pdf-integration.md`](https://makespdf.com/skills/pdf-integration.md).
  How to wire makesPDF into an application codebase once a template
  exists: API-key setup, where to store the `templateId`, error
  handling, retry policy, per-language snippets (Node, Python, Go,
  Ruby, PHP), and patterns for delivering the PDF (browser stream,
  S3, email, background jobs). Read this if the user is asking
  "integrate this into my app" rather than authoring a new template.

<!-- embedded:skip:end -->

## How This Works

1. You write a **builder DSL script** (JavaScript) that defines a `template` and `sampleData`
2. The engine converts it to a DocumentDefinition, resolves `{{variables}}`, lays out elements, and returns a **PDF/A-2A + PDF/UA-1 dual-compliant** PDF (about a second, no AI)
3. All output is archival-grade and accessible: embedded fonts, tagged structure tree, XMP metadata, sRGB ICC color profile

<!-- embedded:skip:start -->

## Choosing an endpoint

makespdf exposes four data-to-PDF endpoints. Pick by **what you have**, not
by what sounds most powerful. A wrong choice costs you 20 minutes of
fighting the tool.

```
What do you have?
│
├── Markdown content, want a PDF with default styling?
│     → POST /api/v1/md               (about a second, no AI)
│
├── Authoring / iterating on a template with inline DSL (free)?
│     → POST /api/v1/preview { dsl, data }   (about a second, deterministic)
│       Full control. Write the DSL yourself (this skill teaches you how).
│
└── Have a saved templateId and want to render it with data (billed)?
      → POST /api/v1/render { templateId, data }   (about a second, deterministic)
        Production path once the DSL is stable. Same pipeline as /preview,
        different input source. Requires an API key or session cookie and
        ownership of the template.
```

**Rule of thumb:** `/md` for docs, `/preview` while you're still shaping
the DSL, `/render` once the template is saved and you're producing
billable PDFs from it. The rest of this document teaches the DSL used by
both `/preview` and `/render`.

**`/preview` is draft-only.** To stop callers from treating preview
output as a final deliverable, every preview render (a) replaces string
values in `data` with length-preserving filler — numbers, booleans,
ISO-like dates, and numeric-looking strings pass through untouched, and
hardcoded labels inside the DSL are always verbatim — and (b) bakes a
diagonal "PREVIEW — NOT FOR USE" overlay into the content stream.
Layout breakages still surface at realistic widths so authoring feedback
stays useful, but the PDF is not usable as a production artifact. When
you want real data in the output, save the template
(`POST /api/v1/templates`) and call `/render` against it.

**Deprecated:** the old `POST /api/v1/render { type, data }` contract
(AI auto-generates a template) has been removed as part of the draft/
publish split. `/render` now exclusively accepts `{ templateId, data }`
against a template you saved via `POST /api/v1/templates`.

### Start from a library template

Before authoring DSL from scratch, check the built-in library — curated
starting points for invoices, receipts, quotes, resumes, and more.
Library rows live in the same `templates` table as your saves; they're
just rows where `ownerUserId IS NULL`, world-readable to any authed
caller.

```
GET  /api/v1/templates?owner=library&category=invoice&q=classic  →  discover
GET  /api/v1/templates/invoice-classic                            →  fetch { dsl, sampleData, ... }
POST /api/v1/render { templateId: "invoice-classic", data }       →  billed render — no fork required
```

You can render a library `templateId` directly. If you want to customise
the DSL (rename columns, swap branding), pull it, edit locally, then
`POST /api/v1/templates` to create your own user-owned copy and render
that.

## When to use this skill (vs. Markdown)

makespdf exposes two independent paths from data to PDF. **Prefer the DSL
path this skill teaches** — it's the full-featured surface. Anything the
PDF engine can render (specific layouts, inline emphasis, links, tables
with precise widths, clickable annotations, custom headers/footers, page
numbering) is reachable from the DSL. Reach for Markdown only when it's a
genuinely better fit for the input:

- **Use this DSL (`POST /api/v1/preview`) when:**
  - The output needs any specific layout — invoices, receipts, quotes,
    reports, CVs, certificates, data tables with aligned columns.
  - You want mid-paragraph emphasis with precise control — e.g. a
    `text()` block mixing `s()`, `bold()`, `italic()`, `link()`, `mono()`
    spans; word-wrapping is preserved across all of them.
  - The document is prose-heavy but needs specific styling the default
    markdown renderer won't produce (custom margins, fonts per section,
    multi-column, coloured callouts, etc.).
  - You need template variables, loops over arrays, or conditionals —
    i.e. the PDF is driven by structured data.

- **Use Markdown (`POST /api/v1/md`) when:**
  - The input is already Markdown (you're not authoring a layout).
  - The document is pure prose and the default markdown styling is fine.
  - You need GFM-specific features the DSL doesn't have atoms for — the
    main one is strikethrough (`~~text~~`); table HTML comment directives
    (`<!-- borderless -->`, `<!-- full-width -->`, `<!-- columns: … -->`);
    GFM alerts (`> [!NOTE]`, `> [!WARNING]`, etc.); Mermaid diagrams in
    fenced code blocks; footnotes (`[^1]`).

Everything else the DSL does more cleanly. A prose-heavy PDF with
occasional emphasis is a perfectly reasonable DSL document — use
`text(...)` blocks with inline shortcut spans.

### `/api/v1/preview` vs `/api/v1/render`

Both endpoints run the same deterministic DSL → PDF pipeline (about a second,
no AI). They differ only in what the caller supplies and how billing works:

- **`POST /api/v1/preview { dsl, data }`** — pass the DSL source inline.
  The authoring / draft endpoint. Free (no credits deducted). Use while
  iterating on a template.
- **`POST /api/v1/render { templateId, data }`** — render a template
  you previously saved via `POST /api/v1/templates`. The production /
  publish endpoint. **Billed** (1 credit per 10 pages). Requires API-key
  or session auth; returns 404 for unknown or non-owned `templateId`.

Typical flow for an agent:

1. Draft the DSL and iterate with `/preview` until it looks right.
2. `POST /api/v1/templates { dsl, name }` → `{ templateId }` (free).
3. Render N times with `POST /api/v1/render { templateId, data }` (billed).

### The same loop over MCP

If your environment supports MCP (Model Context Protocol), the whole
author → render loop is also available as schema-validated tools —
no hand-built HTTP requests. The remote server lives at
`https://makespdf.com/api/v1/mcp` (HTTP transport, JSON-RPC over POST)
and authenticates with the same Bearer API key as the REST API:

```sh
claude mcp add --transport http makespdf \
  https://makespdf.com/api/v1/mcp \
  --header "Authorization: Bearer $MAKESPDF_API_KEY"
```

Ten tools, mirroring the REST endpoints used throughout this skill:

| Tool                 | Mirrors                         | Billing                          |
| -------------------- | ------------------------------- | -------------------------------- |
| `validate_dsl`       | `POST /api/v1/preview/validate` | free                             |
| `validate_markdown`  | `POST /api/v1/md/validate`      | free                             |
| `render_dsl_preview` | `POST /api/v1/preview`          | free, watermarked draft          |
| `save_template`      | `POST /api/v1/templates`        | free                             |
| `list_templates`     | `GET /api/v1/templates`         | free                             |
| `get_template`       | `GET /api/v1/templates/:id`     | free                             |
| `update_template`    | `PUT /api/v1/templates/:id`     | free                             |
| `delete_template`    | `DELETE /api/v1/templates/:id`  | free                             |
| `render_template`    | `POST /api/v1/render`           | **billed** — 1 credit / 10 pages |
| `render_markdown`    | `POST /api/v1/md`               | **billed** — 1 credit / 10 pages |

Library browsing uses the same template tools: `list_templates` with
`owner: "library"` to discover curated templates, `get_template` to pull
DSL + sampleData for a fork.

`render_markdown` is the markdown counterpart to `render_template`, billed
at the same rate. There is no free markdown preview: markdown needs no
layout iteration, so run `validate_markdown` (free) as the pre-flight
instead.

`render_template` produces a real, billable PDF; on the free plan the
output is watermarked, paid plans render clean. Confirm the layout with
`render_dsl_preview` (free) before calling it. This document is also
exposed as an MCP resource (`pdf-template-author`), so you can re-fetch
it through the MCP connection instead of HTTP.

Setup snippets for Claude Desktop, Cursor, and raw HTTP live at
[`/docs/mcp`](https://makespdf.com/docs/mcp).

<!-- embedded:skip:end -->

## Output Format

Output ONLY valid JavaScript. No markdown fences, no explanations. The script must define:

- `const template = doc({...}, ...sections)` — the document template
- `const sampleData = {...}` — example data matching the template's `{{variables}}`

---

<!-- embedded:skip:start -->

## How to use this skill

On first read, skim the whole document. For subsequent tasks, focus on the sections relevant to what you're doing:

- **Every task:** §Builder DSL Reference, §Rules, §Validation Checklist, §Preview API, §Validation API.
- **Deciding between DSL and Markdown:** §When to use this skill (vs. Markdown).
- **No API token yet (or the call returned 401):** §Authentication. Run the device flow — never ask the user for a password or pre-existing API key.
- **Building a new document from scratch:** add §Document Recipes and §Complete Example.
- **Reproducing an existing document** from an image or PDF: add §Reproducing an existing document. You can skip §Complete Example; the reproducing workflow points back to §Document Recipes where needed.
- **Debugging a template that renders wrong:** start with §Validation API, then revisit §Grid + Colspan and §Style Properties.
- **Extending the style kit** with custom classes: §Style Properties + the `doc({ styles })` note at the end of it.

The §Design Principles and §Rules sections are short and load-bearing — always honor them, regardless of task.

<!-- embedded:skip:end -->

---

## Builder DSL Reference

### Document compositor

`doc(opts, ...sections)` — Creates the document.

Options: `{ size, title, author, subject, keywords, styles, padding }`

- `size`: `"A4"`, `"A3"`, `"A5"`, `"Letter"`, `"Legal"` (default A4)
- `title`: Document title, can use `{{variables}}`
- `author`: Document author -> `/Author` + `dc:creator`
- `subject`: One-line description of the document -> `/Subject` + `dc:description`
- `keywords`: Topic keywords, an array or a comma-separated string -> `/Keywords`
- `styles`: Custom style classes to merge with the standard kit
- `padding`: Page padding in points (default 30)

Set `author`, `subject`, and `keywords` on every template you author. Accessibility
checkers flag a PDF that carries only a title (WCAG 2.4.2), and they are the metadata
a reader's assistive technology and a document search index both read. All three
accept `{{variables}}`, so they can come from the render data:

```js
doc({
  size: "A4",
  title: "Invoice {{invoice.number}}",
  author: "{{company.name}}",
  subject: "Invoice {{invoice.number}} for {{customer.name}}",
  keywords: ["invoice", "{{company.name}}"],
}, ...)
```

Auto-wraps content in a page, separates header/footer to top-level. The **standard style kit** is included automatically: <!-- catalog:standard-style-kit:start -->
`.label`, `.body`, `.small`, `.heading`, `.section-heading`, `.table-header`, `.table-cell`, `.table-cell-alt`, `.total-row`, `.footer-bar`

<!-- catalog:standard-style-kit:end -->.

#### Document-wide style changes — set the cascade root

When the user asks for a change that should affect **every** element ("make
the document font NotoSans size 10", "use a darker default text color"),
edit the `"."` selector in `styles` — that's the document-wide cascade root
that every element inherits from. Don't enumerate classes (`.body`, `.label`,
`.heading`, etc.) one at a time — unclassed inline spans (plain `s("text")`,
`bold(...)`, `italic(...)`) don't belong to any of those classes, so they'd
keep the engine default and only half the rendered text would actually
change.

```js
// ✅ Document-wide change — applies to everything, including unclassed spans
doc(
  {
    size: "A4",
    styles: {
      ".": { "font-family": "NotoSans", "font-size": 10 },
    },
  } /* ... */
);

// ❌ Class-by-class — misses inline `s("...")` and `bold(...)` spans
doc(
  {
    styles: {
      ".body": { "font-family": "NotoSans", "font-size": 10 },
      ".label": { "font-family": "NotoSans" },
      ".table-cell": { "font-family": "NotoSans", "font-size": 10 },
      // ...still misses every plain s("...") span in the tree
    },
  } /* ... */
);
```

Sized classes like `.heading` (22pt) and `.small` (8pt) keep their own
sizes via cascade override — they'll pick up the new `font-family` from `.`
but their explicit `font-size` still wins, which is what you want.

### Primitives

| Function                                               | Purpose                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `page(styleOrKid?, ...kids)`                           | Page element                                                                                               |
| `col(widthOrClassOrStyle?, ...kids)`                   | Column (vertical stack). First arg: `"50%"` = width, `".body"` = class, `{style}` = inline style           |
| `r(styleOrKid?, ...kids)`                              | Row (horizontal layout)                                                                                    |
| `s(text)` or `s(".class", text)` or `s({style}, text)` | Span (text content)                                                                                        |
| `text(...spans)` or `text(".class", ...spans)`         | Inline text block — children flow on one line. Use for mixed styles: `text(bold("Date: "), s("15 March"))` |
| `hdr(...kids)`                                         | Header (repeated top of every page)                                                                        |
| `ftr(...kids)`                                         | Footer (repeated bottom of every page)                                                                     |
| `img(src, w, h)`                                       | Image (requires URL, width, height)                                                                        |
| `thisPage()`                                           | Current page number tag                                                                                    |
| `totalPages()`                                         | Total page count tag                                                                                       |
| `each(expr, ...kids)`                                  | Loop: `each("item in items", r(...))`. Inline form: inside `text(each(...))` children flow on one line     |
| `when(expr, ...kids)`                                  | Conditional: `when("discount > 0", ...)`. Supports negation: `when("!@last", s(", "))`                     |
| `elseWhen(expr, ...kids)`                              | Else-if branch                                                                                             |
| `otherwise(...kids)`                                   | Else branch                                                                                                |

`each()` produces either block children (rows, columns) or inline children
(spans) depending on context. Inside `text(each(...))`, each iteration
emits inline spans that flow on a wrapped line. Combine with `when("!@last", …)`
for separator suppression:

```js
text(each("a in authors", s("{{a.name}}"), when("!@last", s(", "))));
// → "Marie Curie, Alan Turing, Ada Lovelace"
```

### Atoms

Inline-text shortcuts (`bold`, `italic`, …) each return a single `span`
Element. They compose inside `text(...)` blocks for mid-paragraph emphasis
and word-wrapping is preserved across line breaks.

| Function                | Purpose                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `bold(text, size?)`     | Bold span (optional font size)                                                            |
| `italic(text, size?)`   | Italic span                                                                               |
| `underline(text)`       | Underlined span                                                                           |
| `mono(text)`            | Monospace (Cousine) span — equivalent to inline code                                      |
| `colored(text, "#hex")` | Coloured span                                                                             |
| `link(href, text?)`     | Clickable link span (underline + accent colour). Omitting `text` uses the URL as the text |
| `muted(text)`           | Small gray caption (8pt, #666)                                                            |
| `hr(margin?, color?)`   | Horizontal divider (default 8pt margin, #d1d5db)                                          |
| `gap(height?)`          | Vertical spacing (default 8pt)                                                            |
| `pageNum()`             | Returns `["Page ", thisPage(), " of ", totalPages()]`                                     |

**Note on strikethrough:** There is no `strike()` atom — the layout engine's
`text-decoration` property currently only supports `underline`. If you need
strikethrough, use Markdown (`/api/v1/md`) which supports GFM `~~text~~`.

### Molecules

**Universal rule for molecules and organisms:** every text-bearing param
(`label`, `value`, `text`, `content`, `lines[]`, `heading`, `title`,
`company`, and table cell contents) accepts **any** of:

- a plain string — `"Hello"`
- a single inline Element — `bold("Hello")`, `muted("caption")`, `link(url)`
- an array mixing the two — `[bold("Date: "), "15 March 2026"]`

You never need to drop to raw `s()` / `text()` just to get emphasis into a
helper. Use `text(...)` only when you want an explicit inline-text block
(e.g. as a `col()` child for a multi-span paragraph); do **not** wrap
`text()` inside molecules that already take Elements — it nests a text
block inside a span and produces surprising output.

| Function                             | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `lv(label, value, labelWidth?)`      | Inline label-value row (default 35%/65%)                                                      |
| `slv(label, value)`                  | Stacked label over value                                                                      |
| `addr(lines)`                        | Address block. `lines` is an array of strings or inline Elements (e.g. `bold("Premium Div")`) |
| `addrR(lines)`                       | Right-aligned address block — same widening                                                   |
| `th(label, width, align?)`           | Table header cell                                                                             |
| `td(value, width, align?)`           | Table data cell                                                                               |
| `totRow(label, value, bold?, grid?)` | Totals row. Without grid: 60%/25%/15%. With grid: uses colspan to align with table columns    |
| `totLine(text)`                      | Combined totals line (65% spacer + 35% right-aligned)                                         |
| `bullet(text)`                       | Bullet point                                                                                  |

### Organisms

| Function                       | Purpose                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `minHdr(title, company)`       | Minimal header (title left, company right). `title`/`company` accept strings or inline Element(s)                                                                                                                                                                                                                        |
| `lvGrid(pairs[], labelWidth?)` | Label-value grid from `[label, value][]` pairs — label/value accept strings or inline Element(s)                                                                                                                                                                                                                         |
| `addrs(from, to)`              | Two-column addresses. Each: `{ label, lines[] }`. Labels and each line accept strings or inline Element(s)                                                                                                                                                                                                               |
| `table(cols, loopExpr, cells)` | Data table with header + loop. `cols`/`cells`: `[content, width?, align?][]` — width and align are optional. Omit width and `table()` picks `auto` for every column, then promotes the widest column to `1fr` so it absorbs surplus (overridable by passing any explicit width). Cell widths inherit from cols by index. |
| `totals(rows, cols?)`          | Totals section. `rows`: `[label, value, bold?][]`. Labels/values accept strings or Element(s). Pass cols for grid+colspan                                                                                                                                                                                                |
| `ftrPages(company?)`           | Footer with page numbers (and optional company name — string or Element(s))                                                                                                                                                                                                                                              |
| `terms(heading, content)`      | Terms/notes block. `heading`/`content` accept strings or inline Element(s) — ideal for prose paragraphs with emphasis                                                                                                                                                                                                    |
| `sigBlock()`                   | Signature lines (two side-by-side)                                                                                                                                                                                                                                                                                       |

### Fillable form fields (AcroForm)

Use these when the PDF needs to be filled in by a human or another agent
after rendering — consent forms, intake forms, surveys, KYC, gov-style
applications. The widgets are real PDF/A-2A + PDF/UA-1 form fields with
pre-baked appearance streams; they remain interactive in Adobe Reader,
Apple Preview, and any modern browser viewer, and they participate in the
tagged structure tree so screen readers can announce them.

Pair every form template with `tagged: true` on the `doc(...)` so the
widgets land inside the structure tree (otherwise they're still fillable
but not accessible). Field `name` must be unique across the document.
Working sample lives in the makesPDF repo at
`assets/samples/forms/consent-form-dsl.js` (template) and
`assets/samples/forms/consent-form-render.pdf` (the rendered output, also
used as a fixture in the per-release veraPDF gate).

| Function         | Purpose                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input(opts)`    | Fillable text field (`/Tx`). `opts`: `{ name, width, height, value?, tooltip?, maxLength?, multiline? }`. Use `multiline: true` for paragraph-sized inputs.                                                       |
| `checkbox(opts)` | Fillable checkbox (`/Btn`). `opts`: `{ name, size, checked?, tooltip?, label? }`. When `label` is provided, returns a row with the box + label text aligned to the right of it — the typical consent-form layout. |
| `select(opts)`   | Fillable dropdown (`/Ch` combo). `opts`: `{ name, width, height, options: [{ label, value }, …], value?, editable?, tooltip? }`. `value` is the initially-selected option's `value`.                              |

Always supply `tooltip` — it's the field's accessible name (`/TU`),
required for PDF/UA-1 conformance and what assistive tech announces.

```js
// Minimal fillable consent block
input({ name: "fullName", width: 400, height: 18, tooltip: "Full legal name", maxLength: 120 }),
gap(6),
select({
  name: "contactMethod", width: 200, height: 20,
  options: [
    { label: "Email",  value: "email" },
    { label: "Phone",  value: "phone" },
    { label: "Postal", value: "post"  },
  ],
  value: "email", tooltip: "How we should reach you",
}),
gap(6),
checkbox({
  name: "consentProcessing", size: 12,
  tooltip: "Consent to data processing (required)",
  label: "I consent to the processing of my personal data.",
}),
```

`value` / `checked` set the **initial** state baked into the PDF; the
viewer is free to overwrite it. To pre-fill from `data`, just thread
`{{variables}}` through `value` like any other string.

Out of scope: `/Sig` digital-signature fields, Acrobat-style JavaScript
calculations, and radio-button groups (use a `select` instead, or model
mutually-exclusive choices as a single checkbox per option).

---

## Raw-drawing escape hatch (`vector()`)

**Use this sparingly.** For prose, tables, lists, or stacked content, reach for the semantic tags (`text`, `bullet`, `dataTable`, `table`, …) — they produce properly tagged PDF/UA output. `vector()` is for bespoke shapes the semantic tags can't express: custom badges, signature boxes, decorative separators, stamped marks, small diagrams.

`vector(opts, ...shapes)` renders declarative SVG-style shapes as native PDF vector graphics (no rasterisation). It returns an `img`-typed element with a baked-in data URI; the layout renderer routes it through the same SVG → PDF pipeline used by markdown SVG images and Mermaid diagrams.

```javascript
vector(
  { width: 120, height: 40, alt: "Approved stamp" },
  rect({
    x: 0,
    y: 0,
    w: 120,
    h: 40,
    rx: 4,
    fill: "#fee2e2",
    stroke: "#b91c1c",
    "stroke-width": 1.5,
  }),
  svgText(
    {
      x: 60,
      y: 26,
      "font-size": 14,
      "font-weight": "bold",
      fill: "#b91c1c",
      "text-anchor": "middle",
    },
    "APPROVED"
  )
);
```

### Shape commands

| Function                   | SVG equivalent                         | Common attrs                                            |
| -------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `rect({x,y,w,h,...})`      | `<rect>` (`w`/`h` map to width/height) | `rx`, `ry`, `fill`, `stroke`, `stroke-width`, `opacity` |
| `circle({cx,cy,r,...})`    | `<circle>`                             | `fill`, `stroke`, `stroke-width`, `opacity`             |
| `ellipse({cx,cy,rx,ry})`   | `<ellipse>`                            | same styling attrs                                      |
| `line({x1,y1,x2,y2,...})`  | `<line>`                               | `stroke`, `stroke-width`, `stroke-dasharray`            |
| `polyline({points,...})`   | `<polyline>`                           | `points: "0,0 10,10 20,0"`                              |
| `polygon({points,...})`    | `<polygon>`                            | `points: "0,0 10,10 20,0"`                              |
| `path({d,...})`            | `<path>`                               | full SVG path grammar: `M L C S Q T A Z H V`            |
| `svgText({x,y,...}, body)` | `<text>`                               | `font-size`, `font-weight`, `fill`, `text-anchor`       |

All coordinates are points in the drawing area's own coordinate system (top-left origin, viewBox defaults to `0 0 width height`). Pass an explicit `viewBox` option to override.

### Gradients

Linear and radial gradients are supported via `defs(...)` + `linearGradient`/`radialGradient` + `stop`, referenced from `fill` or `stroke` using `url(#id)`:

```javascript
vector(
  { width: 200, height: 60, alt: "Gradient banner" },
  defs(
    linearGradient(
      { id: "bg", x1: 0, y1: 0, x2: 1, y2: 0 },
      stop({ offset: 0, "stop-color": "#0ea5e9" }),
      stop({ offset: 1, "stop-color": "#6366f1" })
    )
  ),
  rect({ x: 0, y: 0, w: 200, h: 60, fill: "url(#bg)" })
);
```

- `gradientUnits` defaults to `objectBoundingBox` (coords are 0–1 fractions of the shape's bbox); pass `gradientUnits: "userSpaceOnUse"` for absolute coords.
- `gradientTransform` is supported and composes with the shape's CTM.
- `spreadMethod: "pad"` only — `reflect` / `repeat` render as `pad` with a warning.
- Per-stop `stop-opacity` below 1 is not honoured yet (stops render opaque).

### What it can't do

- `spreadMethod: reflect` / `repeat` (tiled pattern support TBD).
- No filters, masks, or `<foreignObject>` body content (fallback text only).
- No interactive elements or scripting.

### Acceptance checklist

- Always pass `alt` on `vector()` — tagged PDF emits `/Figure` with that `/Alt`. Omitting it produces an empty string alt, which is valid only for purely decorative marks.
- Stick to explicit numeric coordinates; `{{variable}}` substitution does not run inside `vector()` arguments (they execute during DSL evaluation, before template substitution).

---

## Barcodes (`barcode()`)

`barcode(value, options)` renders a Code 39 or Code 128 barcode as native PDF vector graphics — no font, no rasterisation, scannable at any zoom. Returns an `img`-typed element backed by a `barcode:` URL that the renderer expands at output time, so the value can be a `{{template}}` placeholder that resolves per render.

```js
barcode("{{trackingNumber}}", {
  format: "code128", // "code128" (default) or "code39"
  width: 240, // total image width in pt (required-ish, default 200)
  height: 56, // bar height in pt (default 50)
  "show-text": true, // human-readable line below bars (default false)
  "quiet-zone": 10, // module-widths of empty space on each side (default 10)
  "text-font-size": 8, // pt (default 8)
  alt: "Tracking {{trackingNumber}}",
});
```

**Pick a format:**

- `code128` — denser, supports full ASCII 32–127. Default. Use for shipping labels, asset tracking, generic identifiers.
- `code39` — older, ubiquitous in legacy systems. Accepts uppercase A–Z, digits, space, and `- . $ / + %` only. No checksum.

**Sizing for scannability:** module width is derived as `(width − 2·quietZone·moduleWidth) / totalModules`. Aim for a module width ≥ 0.5pt (≈ 0.18mm) so consumer scanners and phone cameras can read the bars. Wider is more reliable; narrower saves space at the cost of scan robustness. The default `quiet-zone: 10` modules of empty space on each side is required by the Code 128 spec — don't lower it without a reason.

**Dynamic values:** the value field accepts `{{template}}` placeholders and resolves at render time. The literal characters `&` and `=` will corrupt the barcode URL (used internally), so values must not contain those — realistic barcode payloads (tracking numbers, SKUs, order IDs) never do.

**Accessibility:** always pass `alt`. The renderer emits a `/Figure` with that `/Alt` for tagged PDF / PDF-UA compliance. If you omit it, the encoded value is used as fallback alt text — fine for human-readable identifiers, less helpful for opaque codes.

---

## QR Codes (`qr()`)

`qr(value, options)` renders a QR code as native PDF vector graphics — no font, no rasterisation, scannable at any zoom. Returns an `img`-typed element backed by a `qr:` URL that the renderer expands at output time, so the value can be a `{{template}}` placeholder that resolves per render. The encoder auto-selects the smallest QR version (21×21 up to 177×177 modules) and the lowest-penalty mask, and picks the most efficient encoding mode (numeric, alphanumeric, or byte/UTF-8) for the payload.

```js
qr("https://pay.example.com/inv/{{invoice.number}}", {
  ecc: "M", // "L" | "M" (default) | "Q" | "H"
  size: 120, // total width/height in pt (square; default 120)
  "quiet-zone": 4, // module-widths of empty space on each side (default 4, spec minimum)
  alt: "Scan to pay invoice {{invoice.number}}",
});
```

**Pick an error-correction level:** higher levels recover more damage at the cost of a larger symbol for the same payload.

- `L` ≈ 7% recovery — densest, smallest. Use for clean-print URLs on screen or pristine paper.
- `M` ≈ 15% recovery — default, the everyday choice.
- `Q` ≈ 25% recovery — receipt paper, dim lighting, expected smudging.
- `H` ≈ 30% recovery — thermal labels, scratched surfaces, anywhere reliability matters more than density.

**Sizing for scannability:** module width is derived as `size / (modules + 2·quietZone)`. Aim for a module width ≥ 1pt (≈ 0.35mm) so phone cameras can resolve modules at a reasonable distance. A 96–120pt box covers most URL-length payloads at ecc M; bump to 150pt+ for long payloads or H-level ecc. The default `quiet-zone: 4` modules is the spec minimum — don't lower it.

**Dynamic values:** the value accepts `{{template}}` placeholders and resolves at render time. The literal characters `&` and `=` will corrupt the QR URL (used internally), so percent-encode them before substitution if your payload is a URL with a query string (most "scan to pay" / tracking deep links don't have query strings, so this rarely bites).

**Accessibility:** always pass `alt`. The renderer emits a `/Figure` with that `/Alt` for tagged PDF / PDF-UA compliance. If you omit it, the encoded value is used as fallback alt text — fine for short URLs, less helpful for opaque payloads.

---

## Grid + Colspan (Table-Aligned Totals)

When a `table()` and `totals()` share the same `cols`, totals rows automatically align with the data table columns using grid+colspan. Here's how it works under the hood:

### How `table()` sets up the grid

`table(cols, loopExpr, cells)` extracts a grid array from `cols` and sets `attr.grid` on every row:

```javascript
const cols = [
  ["Description", "1fr"],
  ["Qty", "auto", "center"],
  ["Price", "auto", "right"],
  ["Amount", "auto", "right"],
];
// → grid = ["1fr", "auto", "auto", "auto"]
// Each header and data row gets attr.grid = ["1fr", "auto", "auto", "auto"]
```

### How `totals()` aligns with the grid

`totals(rows, cols?)` passes the grid to each `totRow()`. With a grid, the totals row has just two cells: a label that spans every column except the last, and the value cell in the last column.

```javascript
totals(
  [
    ["Subtotal", "$500"],
    ["Total", "$600", true],
  ],
  cols
);
// Each totals row becomes:
//   attr.grid    = ["1fr", "auto", "auto", "auto"] ← same grid as the table
//   attr.grid-id = "gid-…"                          ← matches the table's id
//   child 0: label → colspan: 3  (right-aligned, spans Description + Qty + Price)
//   child 1: value → colspan: 1  (right-aligned, Amount column — auto-sized via grid-id)
```

Two things make the value column align with the table's Amount column:

1. **Same `attr.grid`.** Both rows declare the same column tokens, so a fixed/percent token in the last slot resolves identically.
2. **Same `attr.grid-id`.** A deterministic id derived from the `cols` array. The engine groups every row sharing it and resolves their `auto`/`fr` columns _together_, so the value column lines up even when it's `"auto"` (e.g. a Balance column sized to its data).

`table()` and `totals(rows, cols)` set `grid-id` for you. You only need to think about it when hand-writing rows that should join an existing table's group — set `attr["grid-id"]` to the same string the builders generated, or stamp your own consistent id across all rows of the table.

### Manual grid+colspan

For custom layouts beyond `table()`/`totals()`, you can use grid+colspan directly:

```javascript
// A row where the first cell spans 2 of 4 grid columns
r(
  { grid: ["25%", "25%", "25%", "25%"] },
  col({ colspan: 2 }, s("Wide cell")), // spans 50%
  col({ colspan: 1 }, s("Normal cell")), // spans 25%
  col({ colspan: 1 }, s("Normal cell")) // spans 25%
);
```

**Rules:**

- `grid` is set on `r()` (the row) as an array of width strings
- `colspan` is set on `col()` children (default 1)
- Children don't need explicit `width` — the grid determines their width
- The sum of all colspan values should equal the number of grid entries

**Grid token forms:** numbers / `"<n>pt"` (fixed points), `"<n>%"` (percent of row), `"auto"` (sizes to the widest content in that column), `"auto-stretch"` (like `auto`, but the widest such column in the row claims any surplus space — what `table()` writes for omitted widths), and `"<n>fr"` (shares the remaining surplus proportionally — `"1fr"` and `"2fr"` split 1:2). Mix freely: `["120pt", "auto", "1fr"]` pins the first column, sizes the second to its content, and lets the third take whatever's left.

> **Rule for line-item tables: omit widths and let `table()` pick `auto` for every column, with the widest column auto-promoted to absorb surplus.** Equivalently, write `["1fr", "auto", "auto", "auto"]` by hand. Never use `"%"` widths on Qty / Unit Price / Rate / Amount / SKU / Date.
>
> The canonical 4-column invoice — Description + three numeric columns — can be written as `[["Description"], ["Qty", undefined, "right"], ["Unit Price", undefined, "right"], ["Amount", undefined, "right"]]`. Same pattern for receipts, quotes, statements, time-tracking tables, anything with a description + numbers shape.

Why this matters: sizing a numeric column with a fixed percent (e.g. `"10%"` for Unit Price, `"15%"` for Total) is the most common authoring trap. If any data row's value is wider than the slot, the cell wraps onto two lines with the visible text sitting at the bottom of the row, breaking the column's vertical alignment with its neighbours. The grid coordinator resolves `auto`/`fr`/`auto-stretch` widths consistently across the header, every data row, and the totals strip, so there is no upside to defensive percentages and a real downside when data outgrows them. Percents belong in two-up summary blocks (`["55%", "45%"]`) and other true layout splits — not in line-item tables.

---

## Template Variables

- **Simple:** `"{{fieldName}}"` — resolves from data
- **Nested:** `"{{customer.name}}"` — dot notation
- **Loop:** `each("item in items", ...)` — iterates arrays
- **Loop context:** `{{@index}}` (0-based), `{{@first}}`, `{{@last}}`. Negate
  with `!@first` / `!@last` (works inside `when("…")` expressions too).
- **Conditional:** `when("discount > 0", ...)`
- **Expressions:** `"{{qty * price}}"`, `"{{status == 'paid' ? 'Yes' : 'No'}}"`

### Template Filters

Pipe a value through a filter to format it using the `|` syntax inside `{{…}}`:

| Filter                             | Input  | Output       | Notes                                                                                     |
| ---------------------------------- | ------ | ------------ | ----------------------------------------------------------------------------------------- |
| `currency`                         | number | `$1,234.50`  | Defaults to USD. Set a doc-wide default with `doc({ currency: "AUD" }, …)`.               |
| `currency:<ISO code>`              | number | `A$1,234.50` | Per-call override. Accepts any ISO 4217 code (AUD, GBP, EUR, JPY, NZD, CAD, CHF, INR, …). |
| `currency:<ISO code>:<locale tag>` | number | `1.234,50 €` | Optional locale override (e.g. `de-DE`, `fr-FR`). Default locale is `en-US`.              |
| `number`                           | number | `1,234`      | Intl.NumberFormat en-US, thousands separator.                                             |

Examples:

- `"{{amount | currency}}"` → `"$1,234.50"` (USD default)
- `"{{amount | currency:AUD}}"` → `"A$1,234.50"` (AUD with `A$` disambiguation)
- `"{{amount | currency:GBP}}"` → `"£1,234.50"`
- `"{{amount | currency:EUR}}"` → `"€1,234.50"`
- `"{{amount | currency:JPY}}"` → `"¥1,234"` (JPY has no fraction digits)
- `"{{amount | currency:EUR:de-DE}}"` → `"1.234,50 €"` (German locale)
- `"Total: {{total | currency}}"` → `"Total: $15,114.00"`
- `"{{item.qty | number}}"` → `"1,234"`

**Doc-wide default.** Pass `currency` in the `doc({ … })` options to set the
default for bare `{{ x | currency }}` calls — useful for whole-document
locales (e.g. an Australian invoice). Per-call overrides still win.

```js
doc(
  { size: "A4", currency: "AUD" },
  page(
    s("Total: {{total | currency}}"), // → "Total: A$1,234.50"
    s("USD equivalent: {{usd | currency:USD}}") // → "USD equivalent: $800.00"
  )
);
```

Unknown ISO codes (`currency:XYZ`) emit an `unknown-currency-code` warning
and fall back to USD.

**Method calls are not supported.** Expressions like `{{amount.toFixed(2)}}`
evaluate to `undefined` and render as the literal string `undefined`. Use
`| currency` / `| number` instead, or pre-format the value in the data
payload.

**Dates are auto-formatted.** ISO date strings (`"2026-04-10"`) in fields
with date-like names (`date`, `dueDate`, `issued`, `expires`, etc.) are
automatically formatted to human-readable English (`"10 April 2026"`) before
rendering. `YYYY-MM` becomes `"April 2026"`. Non-ISO strings pass through
unchanged. You do not need to pre-format dates — send ISO strings and the
engine handles it.

## Style Properties

> ⚠️ **Style property names are kebab-case, not camelCase.** Even though the
> DSL is JavaScript-like, style property names follow CSS conventions:
> `"font-size"`, `"font-weight"`, `"line-height"`, `"background-color"`,
> `"border-color"`, `"border-radius"`, `"text-decoration"`. Using camelCase
> (`fontSize`, `fontWeight`, `backgroundColor`) produces
> `unknown-style-property` warnings and the styles **will not apply** — the
> element renders with the default instead. Always quote kebab-case keys:
> `{ "font-size": 12 }`, not `{ fontSize: 12 }`.

Available in inline style objects (e.g. `col({ "font-size": 12, width: "50%" }, ...)` — kebab-case, not `fontSize`):

<!-- catalog:style-properties-table:start -->

| Property             | Values                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `font-family`        | `"Inter"`, `"NotoSans"`, `"Cousine"` — default: "Inter"; inherits                                 |
| `font-size`          | number (pt), 4-72 — typical: 8-20. Body: 10. Headings: 14-20. Captions: 8.; default: 10; inherits |
| `font-weight`        | `"normal"`, `"semibold"`, `"bold"` — default: "normal"; inherits                                  |
| `font-style`         | `"normal"`, `"italic"` — default: "normal"; inherits                                              |
| `color`              | hex string — inherits                                                                             |
| `line-height`        | number, 0.5-3 — typical: 1.0-1.6                                                                  |
| `letter-spacing`     | number (pt) — typical: 0-3. Small-caps labels: 1-2.; default: 0; inherits                         |
| `text-transform`     | `"none"`, `"uppercase"`, `"lowercase"`, `"capitalize"` — default: "none"; inherits                |
| `text-decoration`    | `"underline"`                                                                                     |
| `width`              | number (pts), `"50%"`, or `"stretch"`                                                             |
| `max-width`          | number (pts), `"50%"`, or `"stretch"`                                                             |
| `height`             | number (pts), `"50%"`, or `"stretch"`                                                             |
| `margin`             | `[t, r, b, l]` or single number — typical: 0-30. Section spacing: 5-10.                           |
| `padding`            | `[t, r, b, l]` or single number — typical: 0-20                                                   |
| `align`              | `"left"`, `"center"`, `"right"` — inherits                                                        |
| `valign`             | `"top"`, `"center"`, `"bottom"`                                                                   |
| `background-color`   | hex string                                                                                        |
| `border`             | `[t, r, b, l]` or single number                                                                   |
| `border-top`         | number (pt)                                                                                       |
| `border-right`       | number (pt)                                                                                       |
| `border-bottom`      | number (pt)                                                                                       |
| `border-left`        | number (pt)                                                                                       |
| `border-color`       | hex string                                                                                        |
| `border-radius`      | number (pt)                                                                                       |
| `column-span`        | `"all"`                                                                                           |
| `orphans`            | number — typical: 1-3; default: 1                                                                 |
| `widows`             | number — typical: 1-3; default: 1                                                                 |
| `min-presence-ahead` | number (pt) — typical: 30-80. Headings: 40-60.; default: 0                                        |
| `opacity`            | number, 0-1                                                                                       |
| `position`           | `"relative"`, `"absolute"` — default: "relative"                                                  |
| `top`                | number (pt)                                                                                       |
| `left`               | number (pt)                                                                                       |
| `right`              | number (pt)                                                                                       |
| `bottom`             | number (pt)                                                                                       |
| `z-index`            | number — default: 0                                                                               |
| `transform`          | { rotate?: number (degrees), translate?: [x, y] } — applied around the element centre             |

<!-- catalog:style-properties-table:end -->

Units are points (1pt = 1/72 inch). A4 = 595 x 842pt.

Custom styles can extend the standard kit via `doc({ styles: { ".custom": { "font-size": 11 } } }, ...)`.

---

## Document Recipes

> **Per-doc-type assembly skeletons live in
> [`/skills/pdf-recipes.md`](https://makespdf.com/skills/pdf-recipes.md).**
> Fetch that file when you need to author a specific document type —
> Invoice, Receipt, Quote, Statement, Letter, or CV. The recipes are
> self-contained and use only DSL covered in this main skill. Below: a
> short stub kept inline for the most common case (Invoice) so a quick
> `head -N` of this file shows _something_ recognisable; everything else
> is in the companion.

### Invoice (quick reference)

The Invoice recipe is the canonical example. Full version with field
names, totals shape, and footer in the recipes companion.

```
minHdr("Invoice", "{{company.name}}")
lvGrid([["Invoice #:", "{{number}}"], ["Date:", "{{date}}"], ["Due:", "{{dueDate}}"]])
addrs({ label: "From", lines: [...] }, { label: "Bill to", lines: [...] })
const cols = [["Description", "1fr"], ["Qty", "auto", "center"], ["Price", "auto", "right"], ["Amount", "auto", "right"]];
table(cols, "item in items", [cells...])
totals([["Subtotal", "..."], ["Tax", "..."], ["Total", "...", true]], cols)
ftrPages("{{company.name}}")
```

For receipts, quotes, statements, letters, and CVs:
fetch `/skills/pdf-recipes.md`.

### Common table column distributions

For line-item tables (description + numeric columns), default to one stretch + auto everywhere else:

- 3-col: `["1fr", "auto", "auto"]`
- 4-col: `["1fr", "auto", "auto", "auto"]` ← canonical invoice grid
- 5-col: `["1fr", "auto", "auto", "auto", "auto"]`

Percent grids (`["50%", "25%", "25%"]`) are only appropriate when every column is a layout panel rather than a data column — e.g. a two-up address block, a three-up KPI strip. The static checks treat `"%"` widths on numeric headers (Qty, Price, Amount, …) as errors, and a stretch header (Description, Item, …) without a `1fr`/`auto` companion as a warning.

### Dense tables (6+ columns)

A4 portrait has ~535pt of usable row width. With 6+ columns at the default
body size (9–10pt), cells start wrapping mid-word and headers look cramped.
Options, in order of preference:

1. **Drop the table font size to 8pt** via a custom class. Extend the kit:
   `doc({ styles: { ".t-dense": { extend: ".table-cell", "font-size": 8 }, ".t-dense-h": { extend: ".table-header", "font-size": 8 } } }, ...)`,
   then wrap narrow-column values with a span using that class, or pass
   `{ "font-size": 8 }` inline to the cell content.
2. **Switch to landscape** — `doc({ size: "A4", ... })` has no landscape
   flag; use `size: "A3"` portrait (~760pt) or reduce page `padding` to 20
   to reclaim ~20pt per side.
3. **Merge or drop columns** — e.g. combine "Unit Price" and "Unit" into a
   single cell ("$750.00 / PCS"); move HS Code to a secondary row below
   the description via `text(bold("HS "), muted("950630"))`.

When you do use percent widths (layout panels, not line-item tables), the `cols` array sum should be exactly `100%`. Mis-summed grids render but
leave gaps or overflow — the validator flags this as `grid-sum-mismatch`. Grids built from `auto` / `1fr` don't need to sum to anything.
Dense tables on narrow portrait pages are flagged as `dense-table-hint`,
and obviously-too-long text in a constrained cell as `likely-wrap`. The
wrap check is heuristic (estimates glyph width as ~0.5 × em) — bold /
condensed / non-Latin text may over- or under-trigger, so treat it as a
pointer, not a verdict.

### Headers with long company names

`minHdr(title, company)` puts the title left (60%) and the company right
(40%, 16pt bold). Long company names (e.g. "SurfPro Manufacturing Inc.")
will wrap inside the 40% column and push the header taller than intended.
Two fixes:

- **Stack title above company:** skip `minHdr()` and write the two lines
  as separate rows — `r(col(s({ class: "heading" }, "COMMERCIAL INVOICE")))`
  then `r(col({ align: "right" }, s({ "font-size": 14, "font-weight": "bold" }, "{{company.name}}")))`.
- **Shrink the company type ramp:** pass an inline Element instead of a
  string — `minHdr("INVOICE", s({ "font-size": 12, "font-weight": "bold" }, "{{company.name}}"))`.

### Bookmarks (document outline)

Any element (page, column, row, text, span, img) accepts a `bookmark`
attr — either a plain title string or `{ title, expanded? }`. Bookmarks
become entries in the viewer's "Bookmarks" panel, and nesting is inferred
from the element tree: a bookmark on a child becomes a child of the
bookmark on its nearest bookmark-bearing ancestor.

```js
doc(
  { size: "A4" },
  page({ bookmark: "Cover" }, col(s({ class: "heading" }, "Annual Report"))),
  page(
    { bookmark: { title: "Financials", expanded: true } },
    col({ bookmark: "Income statement" } /* ... */),
    col({ bookmark: "Balance sheet" } /* ... */)
  )
);
```

Adding even one bookmark sets `/PageMode /UseOutlines` on the catalog so
Acrobat and Preview open the outline panel by default. Keep titles
terse — viewers truncate long labels.

### Internal `#anchor` links

Any element accepts an `id` attr that becomes an internal destination.
Pass `#id` as the href to `link()` to jump to it — useful for
tables-of-contents, "see Appendix A" cross-references, and
footnote-style back-links.

```js
doc(
  { size: "A4" },
  page(col(s({ class: "heading" }, "Contents")), col(link("#summary", "Jump to summary"))),
  page(col({ id: "summary" }, s({ class: "heading" }, "Summary")), col(s("…body copy…")))
);
```

External URLs (`link("https://…", "…")`) keep working exactly as before
— only hrefs starting with `#` resolve to internal destinations.
Unknown ids fall through as external URIs so broken references are
visible, not silent.

### Stamps & watermarks (absolute positioning)

`position: "absolute"` lifts an element out of flow and places it in page
coordinates via `top` / `left` / `right` / `bottom`. Use for stamps, seals,
badges, and watermarks. Absolute elements don't inflate parent heights and
don't push siblings around.

Supported style keys: `position`, `top`, `left`, `right`, `bottom`, `width`,
`z-index` (paint order — higher paints on top), `opacity` (0–1),
`transform: { rotate: deg, translate: [dx, dy] }` (rotation pivots around
the element centre), `page-repeat: true` (clone onto every page for
watermarks).

Absolutes must live inside a `<page>` ancestor (or at doc-root for
`page-repeat` watermarks). They are rendered as PDF `/Artifact` content so
they don't pollute the tagged-PDF structure tree.

```js
// Diagonal PAID stamp on the first page, top-right corner
text(
  {
    style: {
      position: "absolute",
      top: 80,
      right: 40,
      width: 160,
      opacity: 0.35,
      transform: { rotate: -18 },
      "font-size": 36,
      "font-weight": "bold",
      color: "#b00020",
      border: 3,
      "border-color": "#b00020",
      padding: [6, 12],
      align: "center",
    },
  },
  s("PAID")
);

// Full-page DRAFT watermark repeated on every page
text(
  {
    style: {
      position: "absolute",
      top: 360,
      left: 100,
      width: 400,
      opacity: 0.12,
      transform: { rotate: -30 },
      "font-size": 120,
      "font-weight": "bold",
      color: "#000000",
      align: "center",
      "page-repeat": true,
    },
  },
  s("DRAFT")
);
```

Not supported in V1: percentage coordinates, `transform-origin`, `scale` /
`skew`. Use explicit `width` when you need the stamp to be narrower than the
page.

### Footer vertical space

`ftrPages()` renders a single row with a top border and 5pt top/bottom
padding. The blank strip below it is the page's bottom padding (default
30pt). If the footer feels airy, set `doc({ padding: 20 }, ...)` — that
trims 10pt from all four edges without affecting the footer bar itself.

---

## Design Principles

<!-- catalog:design-principles:start -->

- **Visual hierarchy:** Title (18-24pt bold) > Section headings (12pt bold) > Body (10pt) > Captions (8pt gray)
- **Color palette:** Maximum 2-3 colors. Dark accent (e.g. #1e3a5f) + white + one highlight.
- **Whitespace:** 30-40pt page padding. 5-10pt between major sections. 1-2pt between related items (address lines, label-value rows).
- **Alignment:** Right-align all numbers and monetary values. Left-align all text. When the original shows a company/sender address in the top-right, right-align that entire block by putting "align": "right" on the PARENT COLUMN (not on spans or classes). Right-alignment must always be set on the column container -- it is inherited by children.
- **Vertical space budget:** A4 = 842pt. After page padding (30pt x 2) and footer (~25pt), you have ~757pt of usable content height. BEFORE finalizing, estimate total height: count sections, multiply by average height (~60-80pt for text sections, ~25pt per table row), add all inter-section margins. If the estimate exceeds 757pt, reduce section margins to 5-8pt and use smaller font sizes (body 9pt, table cells 8pt).
- **Page efficiency:** Keep spacing TIGHT. A single-page original must render as single-page. Err on the side of too little spacing rather than too much. For documents with 7+ top-level sections, use 5-8pt inter-section margins (NOT 10-15pt). Every point counts.
- **Logos:** Reference an uploaded asset via `img({ src: "asset:<id>", alt: "<company> logo" })`. Users upload logos / signatures / stamps once at `/settings/assets` and reference them by stable opaque id. SVG and PNG/JPEG all work; bytes are owner-scoped (someone else's `asset:<id>` resolves to a placeholder). Set explicit `width` (80–120pt for invoice headers) so the image scales predictably. If no asset is available, fall back to a text placeholder at 14–16pt max — the logo is a small brand mark, not a giant heading. Avoid raw `https://` image URLs: they break when the host goes down and add latency to every render.
- **Totals alignment:** When the original shows totals labels and values in separate columns aligned with the table, ALWAYS use M6 (row with empty + label + value columns). Only use M7 (combined) when the original clearly shows "Label: $value" as a single right-aligned text block.
<!-- catalog:design-principles:end -->

## Rules

1. **Variables MUST match data structure exactly.** If data has `customer.name`, use `{{customer.name}}`.
2. **Arrays MUST use `each()` loops.** Never hardcode array items.
3. **Use EVERY field** from the provided data. Don't omit fields.
4. **Row children need explicit widths** summing to ~100%.
5. **Text content in `s()` spans.**
6. **Always include `ftrPages()`** for page numbers.
7. **Use `table()` for data tables** — it handles header + loop automatically.
8. **Pass `cols` to `totals()`** so totals rows align with the table via grid+colspan. Exception: when labels are long (>8 chars — "Interest Earned", "Closing Balance") and the N-2 column is narrow (<20%), omit `cols` so the label gets the default 25% width instead of wrapping.
9. **Only valid tags.** No HTML tags (`div`, `table`, `tr`, `td`, `p`, `h1`, etc.).
10. **No images unless data contains image URLs.**
11. **Verify the rendered PDF, not just the validator.** See §Post-render verification.

## DSL Traps

Concrete shapes the builder accepts that tripped up earlier versions — most are now fixed, but the safe spelling is still worth knowing.

- **`s()` 3-arg form works:** `s(".label", { "font-size": 10 }, "Hello")` merges the style into the span's `attr`. When in doubt, prefer the inline form `s({ class: "label", "font-size": 10 }, "Hello")` — both are equivalent. Never write `s("italic", "…")` / `s("bold", "…")` / `s("mono", "…")` / `s("link", "…")` — those throw. Use the helpers `italic(...)` / `bold(...)` / `mono(...)` / `link(...)`, or the class form `s(".italic", "…")`.
- **`col(width, attr, ...kids)` / `r(width, attr, ...kids)` work:** `col("40%", { align: "right" }, s("x"))` is valid. `col({ width: "40%", align: "right" }, s("x"))` is also valid and reads more clearly — pick the form that matches the rest of the file.
- **Class shorthand `".foo"` only works as the FIRST arg.** `s(".foo", …)` is fine; `col(".foo", …)` is fine. But `col("50%", ".foo", …)` does NOT apply the class — `.foo` falls through to kids and renders as literal text. The validator rule `class-string-as-child` now catches this. Use `col("50%", { class: "foo" }, …)` or `col({ width: "50%", class: "foo" }, …)` instead.
- **Border shorthand:** prefer the string form `border: "1px solid #000"` or the tuple form `border: [1, 1, 1, 1]` + separate `"border-color": "#000"`. **Do not** write `border: [1, "solid", "#000"]` — that mixes widths and colours and renders silently wrong.
- **Percent grids must sum to 100%.** Only relevant if you're using percents — line-item tables should use `["1fr", "auto", "auto", …]` instead, which never needs to sum. When you do use percents (layout panels), mismatches become `grid-sum-mismatch` warnings; e.g. a 5-column percent grid should be `["40%", "20%", "10%", "10%", "20%"]`, not `["40%", "8%", "10%", "16%", "16%"]`.
- **Preserve input data types.** If the input `sampleData.items[0].qty` is a number, keep it a number in the generated `sampleData`. Stringifying numerics (e.g. `qty: "2"` instead of `qty: 2`) breaks `| currency` / `| number` filters and arithmetic in expressions.
- **No ES default parameters in arrows.** The DSL executor does not support default-parameter syntax — `(s, n = 8) => s.padStart(n)` throws `Cannot evaluate AssignmentPattern`. Inline the constant (`(s) => s.padStart(8)`) or hoist a separate helper. Rest params are fine; destructured defaults are not.
- **`transform` is an object, not a CSS string.** Write `transform: { rotate: 45 }` or `transform: { rotate: -18, translate: [0, 20] }` — **not** `transform: "rotate(45deg)"`. The string form is silently ignored (rotation falls back to 0°). See §Stamps & watermarks for the full spec. Also: `transform` only applies to `position: "absolute"` elements; setting it on an in-flow row/column does nothing.
- **`pageNum()` returns an array, not a single node.** It expands to `["Page ", thisPage(), " of ", totalPages()]` — four kids. Wrapping it in `s({...}, pageNum())` makes the span's `kids[0]` an array and fails the catalog validator with `"span" has an array in kids[0]`. Always use `ftrPages("…footer text…")` (the helper spreads the kids correctly) or, if you genuinely need a custom footer, spread: `s({...}, ...pageNum())`.

## Common Errors & Fixes

- **`object is not iterable`** — you passed a bare Element where a tuple
  was expected, usually in `table()` cells. Each cell must be
  `[content, width, align?]`, not just `content`. Content itself can be a
  string, an Element, or an array of either.
- **A `text(...)` block renders as one tall line or shows no emphasis** —
  you nested `text()` inside a molecule that already accepts inline
  Elements (e.g. `td(text(bold("X")), "20%")`). Drop the `text()` wrapper
  and pass the span(s) directly: `td(bold("X"), "20%")` or
  `td([bold("Qty: "), "25"], "20%")`.
- **Row children overflow or leave a gap** — `grid` / cell widths don't
  sum to 100%. Recalculate; the validator flags this as `grid-sum-mismatch`
  when percent widths fall outside 98–102%.
- **A numeric column looks left-aligned when you asked for right** —
  `align` must be on the `col()` (or the cell tuple's 3rd slot), not on
  the inner `span`. Column `align` is inherited by children.
- **Header wraps onto two lines** — see "Headers with long company names"
  above. `minHdr()` gives the company 40% of the row; long names need a
  stacked layout or a smaller font size.
- **Table looks cramped at 9 columns** — see "Dense tables (6+ columns)".
  Drop to 8pt or reduce column count before tweaking widths.
- **Monetary values render raw (e.g. `$13740` instead of `$13,740.00`)** —
  use the `currency` filter: `{{amount | currency}}`. See §Template Filters.
- **A cell renders the literal string `undefined`** — an expression
  evaluated to `undefined`. Either the variable path is wrong, or you tried
  an unsupported method call like `{{amount.toFixed(2)}}`. Method calls are
  not supported — use `| currency` / `| number`, or pre-format in the data.

## Validation Checklist

Before outputting, verify:

1. Valid JavaScript? (no syntax errors)
2. Every `{{variable}}` references a field in sampleData?
3. All arrays iterated with `each()`?
4. Row children have explicit widths summing to ~100%?
5. Font sizes between 7-24pt?
6. Colors are valid hex strings?
7. Page fit: estimated total height < 757pt for A4?
8. `const template = doc(...)` and `const sampleData = {...}` both defined?

## Post-render verification

The checklist above and `/api/v1/preview/validate` are both **pre-render**
— they can't tell you that a `{{variable}}` evaluated to `undefined`, that
a loop produced zero rows, or that a layout budget pushed content off the
page. After calling `/api/v1/preview`, verify the PDF _content_ before
handing it back.

1. **Extract the text.** `pdftotext -layout output.pdf -` (or `mutool draw
-F text`, or `qpdf --qdf` + grep for `Tj`). Any tool that reads the
   actual rendered text — not the DSL — will do.
2. **Look for these red flags in the extracted text:**
   - The literal strings `undefined`, `NaN`, `null`, `[object Object]`
     anywhere in the output.
   - Loop-driven sections with fewer rows than your input array (you sent
     14 transactions, the table shows 0 or 3).
   - Monetary values that look unformatted (`$13740` where you wanted
     `$13,740.00`) — see §Template Filters.
   - Blank cells in positions that should be populated.
3. **Diff input vs. output.** Every meaningful value you sent should
   appear somewhere in the extracted text, allowing for formatting
   differences (`6450` → `$6,450.00`).

If any check trips, fix the template and re-render. **Do not report
success until the rendered PDF passes this check.** Catalog validation
catches shape; only the rendered PDF catches content.

---

## Complete Example

```javascript
const cols = [
  ["Description", "1fr"],
  ["Qty", "auto", "center"],
  ["Price", "auto", "right"],
  ["Amount", "auto", "right"],
];
const template = doc(
  { size: "A4", title: "Invoice {{invoiceNumber}}" },
  minHdr("Invoice", "{{company.name}}"),
  lvGrid([
    ["Invoice #:", "{{invoiceNumber}}"],
    ["Date:", "{{date}}"],
    ["Due:", "{{dueDate}}"],
  ]),
  gap(8),
  addrs(
    { label: "From", lines: ["{{company.name}}", "{{company.address}}", "{{company.city}}"] },
    { label: "Bill to", lines: ["{{customer.name}}", "{{customer.address}}", "{{customer.city}}"] }
  ),
  gap(8),
  table(cols, "item in items", [
    ["{{item.description}}", "1fr"],
    ["{{item.qty}}", "auto", "center"],
    ["{{item.price | currency}}", "auto", "right"],
    ["{{item.amount | currency}}", "auto", "right"],
  ]),
  totals(
    [
      ["Subtotal", "{{subtotal | currency}}"],
      ["Tax (10%)", "{{tax | currency}}"],
      ["Total Due", "{{total | currency}}", true],
    ],
    cols
  ),
  gap(8),
  terms("Payment Terms", "{{paymentTerms}}"),
  ftrPages("{{company.name}}")
);

const sampleData = {
  invoiceNumber: "INV-2026-001",
  date: "30 March 2026",
  dueDate: "29 April 2026",
  company: { name: "Acme Corp", address: "123 Main St", city: "San Francisco, CA 94102" },
  customer: { name: "Jane Smith", address: "456 Oak Ave", city: "Portland, OR 97201" },
  items: [
    { description: "Consulting — March 2026", qty: 40, price: 150.0, amount: 6000.0 },
    { description: "Travel expenses", qty: 1, price: 450.0, amount: 450.0 },
  ],
  subtotal: 6450.0,
  tax: 645.0,
  total: 7095.0,
  paymentTerms: "Net 30. Bank transfer to Acme Corp, Account 1234567890.",
};
```

---

<!-- embedded:skip:start -->

## Reproducing an existing document

When the user hands you an image or PDF and asks you to reproduce it (not design a new one), treat this as a reverse-engineering task, not a blank-page design task. The Document Recipes above are for original documents; this section is for matching an existing one.

### The loop

```
  source (image/PDF)
    ↓ extract ground truth (text, font sizes, colors, positions)
  draft DSL script
    ↓ makespdf preview  → rendered PDF
    ↓ makespdf validate → structural issues
    ↓ visual + text compare against the source
  fix → repeat until page count, text content, and layout all match
```

Never hand the template back without running `makespdf preview` at least once. The rendered PDF is the only ground truth for what your DSL actually produces — reasoning about it in your head is not enough.

### Step 1 — Classify and pick a recipe

Identify the document type (invoice, receipt, quote, statement, letter, CV, report) and pick the matching recipe from the Document Recipes section. Recipes constrain _assembly order_ — header → metadata → addresses → body → totals → footer. They are the skeleton; you fill in the specifics from the source. If nothing matches (e.g. a scientific poster, a form), compose from the organisms/molecules directly but keep a strict top-down flow.

### Step 2 — Extract ground truth from the source

**The single biggest fidelity unlock is getting exact metrics out of the source, not guessing from pixels.** Your vision alone will miss font sizes by ±2pt and miss subtle weight differences. PDF content-stream operators are exact. Treat extracted font sizes, names, and colors as ground truth, and treat the image as a _layout hint_, not the other way around.

**If the source is a PDF**, try these in order of preference:

- `pdftotext -layout source.pdf -` (poppler) — preserves column structure, exact strings.
- `pdftotext -bbox-layout source.pdf -` — gives per-word bounding boxes, usable as pseudo-positions.
- `mutool draw -F text source.pdf` — similar, no poppler dependency.
- `qpdf --qdf --object-streams=disable source.pdf out.pdf` then grep `Tf` / `Tj` / `TJ` / `rg` operators in the decompressed content stream — exact font sizes and colors when you need them and the above tools aren't available.

Write the extracted data down in this shape before drafting — it's compact, line-per-run, and survives being pasted into scratch notes:

```
--- Page 1 (595x842pt) ---
  Fonts used: Inter-Bold, Inter-Regular
  Font sizes: 12, 9pt

  Text content (top to bottom):
    [12pt Inter-Bold x:50 y:760] INVOICE
    [9pt Inter-Regular x:50 y:700] Invoice #
    [9pt Inter-Regular x:120 y:700] 5505704273
```

**If the source is an image only**, your vision is the only source. Compensate by:

- Estimating the _base body size_ first. Most professional documents use 7–10pt body text, not 10–12pt. Pick a base and scale everything else from it: title ~1.8–2.2× base, section headings ~1.1–1.3× base, captions ~0.8× base.
- Using the rendered preview to self-correct. If your reproduction looks visibly bigger than the original at the same page size, your base guess was too high — drop it by 1pt and re-render.

### Step 3 — Separate variables from chrome

- Anything that would change between two instances of the same document (numbers, names, dates, line items) becomes a `{{variable}}`. Anything that stays (labels, column headings, footer boilerplate) stays as a literal string.
- Repeated rows (line items, education entries, transactions) become `each()` loops. Never hardcode array items, even if the source only shows three of them.
- Page numbers are always `thisPage()` / `totalPages()` tags. Never a literal "Page 1 of 1".
- Use descriptive camelCase names the end user will recognize (`invoiceNumber`, `items[].description`), not `field1` / `row2`.

### Step 4 — Draft the DSL

- Compose from the atoms / molecules / organisms already defined in this skill. Don't invent new shapes.
- Bind each extracted text run to either a literal `s()` or a `{{variable}}`, matching the font size, weight, and color from the ground-truth extraction. Override the standard style kit via inline styles or `doc({ styles: {...} })` when kit defaults don't match.
- Address blocks: each line is a separate span inside a column. Never one span with embedded `\n`.
- Totals: one row per line (label + right-aligned value) via `totRow()` / `totals()`. Never parallel label-column / value-column layouts.
- **Completeness rule (hard):** every text run in the ground-truth extraction must appear somewhere in the DSL. Missing a currency suffix, a secondary-currency total, an exchange-rate note, or a fine-print disclaimer is the most common reproduction mistake.

### Step 5 — Populate realistic sampleData

- Seed `sampleData` with _actual values from the source_, not `"Lorem"`. Real values surface wrapping and overflow that placeholders hide.
- For arrays, include 2–3 items that reflect the real range of widths (one short description + one long one, one small number + one large one). A loop with one item cannot catch wrapping bugs.
- If the source has multi-currency, negative values, or long customer names, include those in sampleData so the totals and headers actually get exercised.
- If you cannot read a value (pure image, illegible), fall back to name-based guesses: `invoiceNumber` → `"INV-001"`, `total` → `550.00`, `date` → today. Preference order: values the user gave you explicitly > values extracted from the source > name-based defaults.

### Step 6 — Preview, validate, compare, iterate

```bash
makespdf preview template.dsl -o draft.pdf   # render
makespdf validate template.dsl               # structural + a11y issues
```

Then run a three-way compare against the original:

1. **Page count.** Must match. If the draft has more pages than the original, the spacing budget is wrong — reduce all section margins to 5–8pt and drop the base font size by 1pt _before_ fixing anything else. This is the fastest signal you're over-budget.
2. **Text completeness.** Extract text from `draft.pdf` the same way you extracted it from the source in Step 2 and diff the two lists. Anything in the source missing from the draft is a dropped span — go find it.
3. **Visual layout.** Rasterize the draft (`pdftoppm -png -r 150 draft.pdf draft`, `sips -s format png draft.pdf --out draft.png`, or whatever image tool your environment has) and eyeball it side-by-side with the source. Look for column widths, alignment, row heights, border weights.

Fix and re-run. Do not return the template to the user until all three checks pass, or until you've called out a documented gap they've accepted.

### Hard constraints cheat sheet

Reproduction work adds these on top of §Design Principles and §Rules — don't relax those for reproductions:

- **Title** max `22pt`. **Any other text** max `18pt`. Never larger.
- **Section-to-section margin** max `10pt` absolute. Values of 15, 20, 25+ are never allowed; if any margin top exceeds 10, reduce it to 8.
- **Completeness beats elegance.** Every text run from the source — currency suffixes, secondary totals, exchange-rate notes, fine print — must appear in the output.

The A4 `~757pt` vertical budget, `thisPage()` / `totalPages()` tags for page numbers, and top-level `ftr()` placement are already covered in §Design Principles and §Rules.

<!-- embedded:skip:end -->

---

<!-- embedded:skip:start -->

## Authentication

> **Full agent walkthrough lives in
> [`/skills/pdf-auth.md`](https://makespdf.com/skills/pdf-auth.md).**
> Read that companion if you don't already have a Bearer token — it
> covers the OAuth device flow (RFC 8628), why you should never ask the
> user for an email and password, and the right error-handling for each
> step.

Once you have a token, set `Authorization: Bearer <token>` on every
`/api/v1/*` request. Authentication is the default — every endpoint
requires a token unless it's an explicit carve-out (today: `POST
/api/v1/pdf/validate` and, when the operator enables it, `POST
/api/v1/md`). Stale / invalid tokens always 401; the server never
silently downgrades a failed auth attempt to anonymous. A 401 response
carries a `device_authorization` block pointing at the exact URLs to
start the OAuth device flow.

---

## API endpoints

> **The how-to-call-it reference for every endpoint lives in
> [`/skills/pdf-api.md`](https://makespdf.com/skills/pdf-api.md).** That
> companion covers `POST /api/v1/preview` (free draft renders), `POST
/api/v1/render` (billed renders against a saved template), `POST
/api/v1/preview/validate` (catalog + a11y check, no render), error
> codes, billing rules, and the `jq`-based shell pattern for sending
> multi-line DSL.

Two-line cheat sheet:

- **Authoring / iterating:** `POST /api/v1/preview { dsl, data }` →
  PDF binary. Free, watermarked, string filler.
- **Production:** `POST /api/v1/templates { dsl, name }` → save once,
  then `POST /api/v1/render { templateId, data }` → PDF binary.
  Billed at 1 credit / 10 pages.

Custom fonts: see [`/skills/pdf-fonts.md`](https://makespdf.com/skills/pdf-fonts.md).

<!-- embedded:skip:end -->
