# PDF Template Author Skill

> **Note to AI agents:** This document is served over HTTP at
> `https://makespdf.com/skills/pdf-template-author.md` (or
> `http://localhost:8788/skills/pdf-template-author.md` in dev). It is **not
> a local file.** If you need to re-fetch it, use a web fetch / HTTP tool —
> do **not** call your filesystem `Read` tool with `/skills/...`. Paths
> that begin with `/api/v1/`, `/device`, or `/skills/` in this document are
> URL paths relative to the makespdf origin, not filesystem paths.

You are an expert PDF template designer. You create templates using a compact builder DSL that renders into professional PDF documents via the makespdf.com engine.

## How This Works

1. You write a **builder DSL script** (JavaScript) that defines a `template` and `sampleData`
2. The engine converts it to a DocumentDefinition, resolves `{{variables}}`, lays out elements, and returns a **PDF/A-2A + PDF/UA-1 dual-compliant** PDF (~100ms, no AI)
3. All output is archival-grade and accessible: embedded fonts, tagged structure tree, XMP metadata, sRGB ICC color profile

## Choosing an endpoint

makespdf exposes four data-to-PDF endpoints. Pick by **what you have**, not
by what sounds most powerful. A wrong choice costs you 20 minutes of
fighting the tool.

```
What do you have?
│
├── Markdown content, want a PDF with default styling?
│     → POST /api/v1/md               (~100ms, no AI)
│
├── Markdown with `---` slide breaks for LinkedIn?
│     → POST /api/v1/carousel         (~100ms, no AI)
│
├── Authoring / iterating on a template with inline DSL (free)?
│     → POST /api/v1/preview { dsl, data }   (~100ms, deterministic)
│       Full control. Write the DSL yourself (this skill teaches you how).
│
└── Have a saved templateId and want to render it with data (billed)?
      → POST /api/v1/render { templateId, data }   (~100ms, deterministic)
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

Both endpoints run the same deterministic DSL → PDF pipeline (~100ms, no
AI). They differ only in what the caller supplies and how billing works:

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

## Output Format

Output ONLY valid JavaScript. No markdown fences, no explanations. The script must define:

- `const template = doc({...}, ...sections)` — the document template
- `const sampleData = {...}` — example data matching the template's `{{variables}}`

---

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

---

## Builder DSL Reference

### Document compositor

`doc(opts, ...sections)` — Creates the document.

Options: `{ size, title, author, styles, padding }`

- `size`: `"A4"`, `"A3"`, `"A5"`, `"Letter"`, `"Legal"` (default A4)
- `title`: Document title, can use `{{variables}}`
- `styles`: Custom style classes to merge with the standard kit
- `padding`: Page padding in points (default 30)

Auto-wraps content in a page, separates header/footer to top-level. The **standard style kit** is included automatically: `.label`, `.body`, `.small`, `.heading`, `.section-heading`, `.table-header`, `.table-cell`, `.table-cell-alt`, `.total-row`, `.footer-bar`.

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

| Function                       | Purpose                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minHdr(title, company)`       | Minimal header (title left, company right). `title`/`company` accept strings or inline Element(s)                                                                    |
| `lvGrid(pairs[], labelWidth?)` | Label-value grid from `[label, value][]` pairs — label/value accept strings or inline Element(s)                                                                     |
| `addrs(from, to)`              | Two-column addresses. Each: `{ label, lines[] }`. Labels and each line accept strings or inline Element(s)                                                           |
| `table(cols, loopExpr, cells)` | Data table with header + loop. `cols`/`cells`: `[content, width, align?][]` where `content` is a string, an inline Element, or an array of either. Sets grid on rows |
| `totals(rows, cols?)`          | Totals section. `rows`: `[label, value, bold?][]`. Labels/values accept strings or Element(s). Pass cols for grid+colspan                                            |
| `ftrPages(company?)`           | Footer with page numbers (and optional company name — string or Element(s))                                                                                          |
| `terms(heading, content)`      | Terms/notes block. `heading`/`content` accept strings or inline Element(s) — ideal for prose paragraphs with emphasis                                                |
| `sigBlock()`                   | Signature lines (two side-by-side)                                                                                                                                   |

---

## Grid + Colspan (Table-Aligned Totals)

When a `table()` and `totals()` share the same `cols`, totals rows automatically align with the data table columns using grid+colspan. Here's how it works under the hood:

### How `table()` sets up the grid

`table(cols, loopExpr, cells)` extracts a grid array from `cols` and sets `attr.grid` on every row:

```javascript
const cols = [
  ["Description", "45%"],
  ["Qty", "15%", "center"],
  ["Price", "20%", "right"],
  ["Amount", "20%", "right"],
];
// → grid = ["45%", "15%", "20%", "20%"]
// Each header and data row gets attr.grid = ["45%", "15%", "20%", "20%"]
```

### How `totals()` aligns with the grid

`totals(rows, cols?)` passes the grid to each `totRow()`. With a grid, `totRow()` uses `colspan` instead of fixed widths:

```javascript
totals(
  [
    ["Subtotal", "$500"],
    ["Total", "$600", true],
  ],
  cols
);
// Each totals row becomes:
//   attr.grid = ["45%", "15%", "20%", "20%"]     ← same grid as the table
//   child 0: spacer  → colspan: 2  (spans "45%" + "15%" = 60%)
//   child 1: label   → colspan: 1  (spans "20%")
//   child 2: value   → colspan: 1  (spans "20%", right-aligned)
```

This ensures the "Amount" column in the table and the value column in totals are pixel-aligned, regardless of column widths.

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

| Property           | Values                                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| `font-family`      | `"Inter"` (default), `"NotoSans"`                                          |
| `font-size`        | number (pts). Body: 9-10, headings: 14-22, range: 7-24                     |
| `font-weight`      | `"normal"`, `"bold"`                                                       |
| `font-style`       | `"normal"`, `"italic"`                                                     |
| `color`            | hex string, e.g. `"#333333"`                                               |
| `background-color` | hex string                                                                 |
| `width`            | number (pts), `"50%"`, or `"stretch"`                                      |
| `height`           | number (pts), `"stretch"`, or omit for auto                                |
| `margin`           | `[t, r, b, l]` or single number                                            |
| `padding`          | `[t, r, b, l]` or single number                                            |
| `border`           | `[t, r, b, l]` — widths in pts, 0 = no border                              |
| `border-color`     | hex string                                                                 |
| `border-radius`    | number                                                                     |
| `align`            | `"left"`, `"center"`, `"right"` — set on **column**, inherited by children |
| `valign`           | `"top"`, `"center"`, `"bottom"`                                            |
| `line-height`      | multiplier, e.g. `1.2`                                                     |
| `text-decoration`  | `"underline"`                                                              |
| `opacity`          | 0-1                                                                        |

Units are points (1pt = 1/72 inch). A4 = 595 x 842pt.

Custom styles can extend the standard kit via `doc({ styles: { ".custom": { "font-size": 11 } } }, ...)`.

---

## Document Recipes

Assembly order (top to bottom) for common document types:

### Invoice

```
minHdr("Invoice", "{{company.name}}")
lvGrid([["Invoice #:", "{{number}}"], ["Date:", "{{date}}"], ["Due:", "{{dueDate}}"]])
gap(8)
addrs({ label: "From", lines: [...] }, { label: "Bill to", lines: [...] })
gap(8)
const cols = [["Description", "45%"], ["Qty", "15%", "center"], ["Price", "20%", "right"], ["Amount", "20%", "right"]];
table(cols, "item in items", [cells...])
totals([
  ["Subtotal", "{{subtotal | currency}}"],
  ["Tax",      "{{tax | currency}}"],
  ["Total",    "{{total | currency}}", true],
], cols)
terms("Payment Terms", "{{terms}}")
ftrPages("{{company.name}}")
```

### Receipt

```
minHdr("Receipt", "{{company.name}}")
lvGrid([["Receipt #:", "{{number}}"], ["Date:", "{{date}}"], ["Payment:", "{{paymentMethod}}"]])
addr(["{{customer.name}}", "{{customer.address}}"])
gap(8)
table([headers...], "item in items", [cells...])
totals([["Subtotal", "..."], ["Tax", "..."], ["Total Paid", "...", true]])
terms("Return Policy", "{{returnPolicy}}")
ftrPages()
```

### Quote / Estimate

```
minHdr("Quote", "{{company.name}}")
lvGrid([["Quote #:", "{{number}}"], ["Date:", "{{date}}"], ["Valid Until:", "{{validUntil}}"]])
addrs({ label: "From", lines: [...] }, { label: "To", lines: [...] })
table([headers...], "item in items", [cells...])
totals([...])
terms("Terms & Conditions", "{{terms}}")
sigBlock()
ftrPages("{{company.name}}")
```

### Statement / Report

```js
// Date column budget:
// - Full format ("2 March 2026"): 18% min of A4-page width at 10pt.
//   (16% wraps at default padding -- leave a safety margin.)
// - Short format ("02 Mar" or "2026-03-02"): 10-12% is fine.
// Columns are percentages of page content-area width (minus padding) and
// should sum to exactly 100%.
const cols = [
  ["Date", "18%"], // 18% min at default padding -- full-format dates wrap below this
  ["Description", "42%"],
  ["Debit", "13%", "right"],
  ["Credit", "13%", "right"],
  ["Balance", "14%", "right"],
];

minHdr("Statement", "{{company.name}}");
lvGrid([
  ["Period:", "{{period}}"],
  ["Account:", "{{accountNumber}}"],
]);
// Optional summary box:
col(
  {
    border: [1, 1, 1, 1],
    "border-color": "#d1d5db",
    "border-radius": 4,
    padding: [10, 12, 10, 12],
  },
  bold(["Opening Balance: ", "{{openingBalance | currency}}"]),
  s(["Closing Balance: ", "{{closingBalance | currency}}"])
);
table(cols, "tx in transactions", [
  ["{{tx.date}}", "18%"],
  ["{{tx.desc}}", "42%"],
  [when("tx.debit", s("{{tx.debit | currency}}")), "13%", "right"],
  [when("tx.credit", s("{{tx.credit | currency}}")), "13%", "right"],
  ["{{tx.balance | currency}}", "14%", "right"],
]);
// Totals: omit `cols` here. Statement labels ("Interest Earned", "Closing
// Balance") are 14-16 chars and need ~25% width. Passing `cols` would
// give the label only 13% (the N-2 Credit column) and wrap every line.
// The default layout is 60% spacer / 25% label / 15% value.
totals([
  ["Fees Charged", "{{fees | currency}}"],
  ["Interest Earned", "{{interestEarned | currency}}"],
  ["Closing Balance", "{{closingBalance | currency}}", true],
]);
ftrPages("{{company.name}}");
```

A cell's content slot accepts a `when()` wrapper for conditional rendering.
Use this for columns populated on some rows but not others (debit/credit,
discount, optional fees) — an empty cell stays blank instead of rendering
the literal string `undefined`.

> Wrapping inside a table cell is silent — nothing fails. If your data has
> long strings (full-format dates, multi-word descriptions, amounts with
> thousand separators), budget width generously and verify in the rendered
> PDF (see §Post-render verification).

### Letter

```
minHdr("", "{{sender.name}}")
addr(["{{sender.name}}", "{{sender.address}}", "{{sender.city}}"])
s("{{date}}")
addr(["{{recipient.name}}", "{{recipient.address}}", "{{recipient.city}}"])
gap(12)
// Body paragraphs — each as a separate span with line-height 1.4.
// Inline style keys are kebab-case, not camelCase: "font-size", "line-height" (not fontSize/lineHeight).
s({ "font-size": 11, "line-height": 1.4 }, "{{salutation}}")
s({ "font-size": 11, "line-height": 1.4 }, "{{body}}")
gap(20)
sigBlock()
ftrPages()
```

### CV / Résumé

Assembly order: name + headline → contact row → summary → experience (loop) → education (loop) → skills.

```js
const template = doc(
  { size: "A4", title: "{{name}} — CV" },
  // Name + headline.
  // Style keys are kebab-case: "font-size", "font-weight" — NOT fontSize/fontWeight.
  // camelCase keys produce unknown-style-property warnings and the styles do not apply.
  s({ "font-size": 22, "font-weight": "bold" }, "{{name}}"),
  s({ "font-size": 11, color: "#555555" }, "{{headline}}"),
  // Contact row: inline icons/labels + link atoms. One row keeps width predictable.
  text(
    s("{{location}}"),
    s("  ·  "),
    link("mailto:{{email}}", "{{email}}"),
    s("  ·  "),
    link("{{github}}", "github.com/{{githubHandle}}")
  ),
  gap(8),
  // Summary paragraph
  s({ "font-size": 10, "line-height": 1.4 }, "{{summary}}"),
  gap(10),
  // Experience
  s({ class: "section-heading" }, "Experience"),
  each(
    "job in experience",
    r(
      { grid: ["70%", "30%"] },
      col("70%", bold("{{job.role}} — {{job.company}}")),
      col({ width: "30%", align: "right" }, s({ color: "#666666" }, "{{job.from}} – {{job.to}}"))
    ),
    each("b in job.bullets", bullet("{{b}}"))
  ),
  gap(8),
  // Education
  s({ class: "section-heading" }, "Education"),
  each(
    "ed in education",
    r(
      { grid: ["70%", "30%"] },
      col("70%", bold("{{ed.degree}} — {{ed.school}}")),
      col({ width: "30%", align: "right" }, s({ color: "#666666" }, "{{ed.year}}"))
    )
  ),
  gap(8),
  // Skills — inline each() with separator suppression
  s({ class: "section-heading" }, "Skills"),
  text(each("sk in skills", mono("{{sk}}"), when("!@last", s(" · ")))),
  ftrPages()
);
```

Common gotchas:

- **Date field names vary.** This recipe uses `{{job.from}}` / `{{job.to}}`
  to match JSON Resume and most real-world résumé data. Other shapes
  use `start`/`end` or `startDate`/`endDate` — match whatever the data
  actually has; don't rename the data to match the recipe.
- **Contact-line wrap.** If email + location are long, split the row into
  two columns (contact left / links right) or drop the line-height to 1.2.
- **Skills list** uses the inline-`each()` pattern — see Primitives for
  the shape. If you pre-join into a single string you lose the
  per-skill `mono()` styling.
- **Two-page CVs** need column-flow layout, which the engine doesn't
  support yet. Keep to one page by trimming summary/bullets, not by
  shrinking the font below 9pt.

### Common table column distributions

- 3-col: 50% / 25% / 25%
- 4-col: 40% / 15% / 20% / 25%
- 5-col: 40% / 10% / 20% / 10% / 20%

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

The `cols` array sum should be exactly `100%`. Mis-summed grids render but
leave gaps or overflow; the validator does not currently warn.

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

### Footer vertical space

`ftrPages()` renders a single row with a top border and 5pt top/bottom
padding. The blank strip below it is the page's bottom padding (default
30pt). If the footer feels airy, set `doc({ padding: 20 }, ...)` — that
trims 10pt from all four edges without affecting the footer bar itself.

---

## Design Principles

- **Visual hierarchy:** Title (18-24pt bold) > Section headings (12pt bold) > Body (10pt) > Captions (8pt gray)
- **Colors:** Max 2-3 colors. Dark accent + white + one highlight.
- **Alignment:** Right-align all numbers and monetary values. `align` is set on columns and inherited by children.
- **Spacing:** 5-10pt margin between sections. Err on less spacing, not more.
- **Page budget:** A4 has ~757pt usable height (842 - 60pt padding - 25pt footer). Estimate before outputting.

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
  sum to 100%. Recalculate; the validator doesn't warn about this yet.
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
  ["Description", "45%"],
  ["Qty", "15%", "center"],
  ["Price", "20%", "right"],
  ["Amount", "20%", "right"],
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
    ["{{item.description}}", "45%"],
    ["{{item.qty}}", "15%", "center"],
    ["{{item.price | currency}}", "20%", "right"],
    ["{{item.amount | currency}}", "20%", "right"],
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

---

## Authentication

Every `/api/v1/*` endpoint requires a Bearer token. **If you don't already
have one, do not ask the user for their email and password — run the OAuth
device flow instead.** It exists so AI agents and CLIs can authenticate
without ever handling the user's credentials.

### Device authorization flow (RFC 8628)

1. **Request a code.** No auth required:

   ```
   POST /api/v1/device/code
   Content-Type: application/json

   { "client_name": "Claude" }
   ```

   Response:

   ```json
   {
     "device_code": "<long opaque string, keep secret>",
     "user_code": "ABCD-1234",
     "verification_uri": "https://makespdf.com/device",
     "verification_uri_complete": "https://makespdf.com/device?code=ABCD-1234",
     "expires_in": 600,
     "interval": 5
   }
   ```

2. **Show the user the verification URL and code.** A good prompt:

   > "To let me render PDFs on your account, open
   > **https://makespdf.com/device?code=ABCD-1234** in your browser and
   > click Approve. The code is **ABCD-1234** — make sure it matches what
   > the page shows. **Tell me when you've approved and I'll finish up.**"

   **If you have browser tools, stop browsing now.** Do not open the
   verification URL, do not navigate, do not click — your part of the flow
   is done until the human signs in and approves. Polling (step 3) is a
   server-to-server API call; no browser needed. Opening `/device` yourself
   will hit a login screen, and the account that gets charged is whoever
   signs in — so unless your user is already signed in on that profile,
   you are about to register or log in on their behalf. Don't.

3. **Wait for the user to approve, then fetch the token.** Do not poll.
   Ask the user to tell you when they've clicked Approve; when they do,
   make **one** request to exchange the device code for an access token:

   ```
   POST /api/v1/device/token
   Content-Type: application/json

   { "device_code": "<from step 1>" }
   ```

   - HTTP 200 `{ "access_token": "mpdf_...", "token_type": "Bearer" }` —
     you're done.
   - HTTP 400 `{ "error": "authorization_pending" }` — the approval hasn't
     landed yet. Ask the user to double-check the browser page and tell
     you when the "Approved" confirmation is visible, then try once more.
   - HTTP 403 `{ "error": "access_denied" }` — user declined. Stop.
   - HTTP 410 `{ "error": "expired_token" }` — the 10-minute window
     elapsed. Start over from step 1.

   Why not poll: you have a human in the loop. The user is the trigger,
   not a clock. Polling while waiting scrolls the approval prompt out of
   the user's view and adds no information. Make a single call when the
   user says they're ready.

   _Automated harnesses_ with no interactive user (CI smoke tests,
   scripted demos) may fall back to polling `/device/token` on the
   `interval` from step 1. This is allowed but noisy — prefer user-driven
   confirmation when a user is present.

4. **Use the token** as `Authorization: Bearer <access_token>` on every
   subsequent `/api/v1/*` request. Persist it locally so you don't have to
   re-run the flow next time.

### Don't do this

- ❌ Asking the user for an email and password directly. There is no
  password endpoint to send them to.
- ❌ Asking the user to paste an API key when no token is available. The
  device flow is faster, safer, and doesn't require them to leave their
  current task to go generate one.
- ❌ **Registering an account on the user's behalf.** If the device approval
  page (`/device?code=…`) shows a login screen when you open it in a
  browser MCP, stop. Tell the user: "I've requested a device code — please
  sign in at \<verification_uri_complete\> and click Approve." Wait for
  them. Never click through a registration form or submit credentials
  yourself. The account owner is the person whose credits get charged; it
  must be a human decision.
- ❌ Signing in with credentials the user has not just typed into your
  chat. Even if you have them from a previous turn, re-prompt or hand
  control back — do not auto-fill the login form.
- ❌ Calling `/api/v1/preview` or `/api/v1/md` without a Bearer token and
  hoping it works. Every endpoint requires auth — anonymous access does
  not exist, even in dev.

If a request returns 401, parse the response body — it contains a
`device_authorization` block with the exact URLs to use.

---

## Preview API

Render your template by sending it to the preview endpoint. The `dsl` field
is **your DSL script serialized as a JSON string** — newlines escaped as
`\n`, double quotes escaped as `\"`. `data` is the JSON object your
`{{variables}}` resolve against; omit it and the engine falls back to the
`sampleData` declared inside the script.

```
POST /api/v1/preview
Authorization: Bearer <your access_token>
Content-Type: application/json

{
  "dsl": "const template = doc({ size: \"A4\" }, page(col(s(\"Hello {{name}}\"))));\nconst sampleData = { name: \"World\" };",
  "data": { "name": "Ada" }
}
```

Runnable curl with a tiny template inline (multi-line DSL goes in a file —
see §Sending DSL from a shell):

```bash
curl -X POST "$API/api/v1/preview" \
  -H "Authorization: Bearer $MAKESPDF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dsl":"const template = doc({ size: \"A4\" }, page(col(s(\"Hello {{name}}\"))));\nconst sampleData = { name: \"World\" };","data":{"name":"Ada"}}' \
  -o hello.pdf
```

Response: PDF binary (default) or JSON metadata (with `Accept: application/json` header).

Responses on the free / dev tier include a small `makespdf.com` attribution
line in the footer area. Paid tiers remove it.

### Sending DSL from a shell

The `dsl` field is a JSON string, so embedding a multi-line DSL script
inline is awkward (template-literal backticks, escaped newlines, `{{…}}`
syntax that linters misread as JS interpolation). Write the DSL to a file,
then build the JSON payload with `jq`:

```bash
cat > template.js <<'EOF'
const cols = [["Description", "50%"], ["Qty", "20%", "right"], ["Amount", "30%", "right"]];
const template = doc({ size: "A4" }, minHdr("Invoice", "Acme Corp") /* … */);
const sampleData = { /* … */ };
EOF

jq -n --rawfile dsl template.js --argjson data "$(cat data.json)" \
  '{ dsl: $dsl, data: $data }' |
  curl -sX POST "${API}/api/v1/preview" \
    -H "Authorization: Bearer $MAKESPDF_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @- -o invoice.pdf
```

`jq -n --rawfile` avoids manually escaping newlines and quotes. If you
don't have a separate `data.json`, omit the `--argjson data` and drop
`data: $data` — the engine will fall back to the script's `sampleData`.

---

## Render API

Once a template is stable, save it once and render it many times with
different data. Two steps:

**1. Save the template** (free, `POST /api/v1/templates`):

```bash
jq -n --rawfile dsl template.js --arg name "Acme invoice" \
  '{ dsl: $dsl, name: $name }' |
  curl -sX POST "$API/api/v1/templates" \
    -H "Authorization: Bearer $MAKESPDF_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @-
# → { "templateId": "…uuid…", "name": "Acme invoice", "createdAt": … }
```

**2. Render with data** (billed, `POST /api/v1/render`):

```
POST /api/v1/render
Authorization: Bearer <your access_token>
Content-Type: application/json

{
  "templateId": "11111111-2222-3333-4444-555555555555",
  "data": { "invoiceNumber": "INV-042", "items": [ … ] }
}
```

```bash
curl -X POST "$API/api/v1/render" \
  -H "Authorization: Bearer $MAKESPDF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"templateId":"…uuid…","data":{ … }}' \
  -o invoice.pdf
```

Response: PDF binary (default) or JSON metadata (with
`Accept: application/json`). Headers include `X-Pages`, `X-Credits-Deducted`,
`X-Credits-Remaining`.

Error responses:

- **400** — malformed JSON, missing `templateId`, non-UUID `templateId`, or
  non-object `data`.
- **401** — no valid Bearer token / session cookie.
- **402** — credits exhausted. Upgrade or top up at `/settings/billing`.
- **404** — `templateId` is unknown **or** not owned by the caller. The
  response is identical in both cases by design — the endpoint never
  confirms existence of other users' templates.
- **429** — rate limit (200 renders/hour per caller).

**Billing:** 1 credit per 10 pages on success. **Every failure path
deducts zero credits** — validation errors, 404s, 402s, and render
exceptions all leave the balance untouched.

---

## Validation API

Before rendering, validate your template for structure and accessibility issues:

```
POST /api/v1/preview/validate
Authorization: Bearer <your access_token>
Content-Type: application/json

{
  "dsl": "<your DSL script as a string>"
}
```

Response:

```json
{
  "valid": true,
  "issues": [
    {
      "severity": "warning",
      "message": "Image missing alt text ...",
      "path": "kids[0].kids[2]",
      "rule": "a11y-missing-alt"
    }
  ],
  "summary": { "errors": 0, "warnings": 1 }
}
```

This is a cheap pre-flight check (no rendering). It catches:

- **Catalog issues**: unknown tags, invalid nesting, unknown style properties, missing row widths
- **Accessibility issues**: images missing alt text (required for PDF/UA-1)

**Best practice:** Always call `/api/v1/preview/validate` before `/api/v1/preview`. If issues are found, fix them and re-validate. Report any warnings to the user so they can make informed decisions about accessibility.
