# Multitap — Style Reference (Light)

> Warm, paper-like canvas. Soft cool-grey shadows, a serif display headline over a four-family sans stack, vibrant ember orange used sparingly as a brand mark, cobalt-purple as the only filled chromatic accent.

**Theme:** light

> **How to read this doc.** This is the prose narrative — the *intent* of the design language. The actual tokens and component CSS live in [`public/style.css`](../public/style.css), which is the single source of truth. Two naming layers coexist in that file: the **reference tokens** documented in the tables below (`--neutral-white`, `--main-orange`, …) declare raw values, and the **semantic tokens** (`--color-pure-white`, `--color-ember-orange`, …) alias them with role-based names. Component CSS uses the semantic layer; the reference layer exists so the two themes can re-point semantic names at different raw values without touching component code.

This design system reads like a notebook on a clean desk. Surfaces are near-white (`#ffffff` / `#f7f7f7`) with a single neutral hairline (`#e5e5e5`); shadows are cool grey rather than black so elevation feels weightless. A small, intentional cast of typefaces does almost all of the visual work: a serif display (Playfair Display) for headings, a humanist sans (Nunito) for uppercase eyebrows and pill button labels, a friendly text sans (DM Sans) for body and hints, and a neutral UI sans (Inter) for controls and lists. Color is rationed: ember orange (`#fb5305`) is the brand mark — eyebrows, the active sidebar bullet, the active-tool outline — never a fill. Cobalt purple (`#a45fff`) is the only chromatic interactive *fill* (focus rings, the checked checkbox, the share-link URL). Outlined pill buttons in green (constructive) and red (destructive) carry the modal action moments. Six status hue families (orange / purple / green / blue / red / yellow), each with light / medium / strong tiers, supply the palette for user-pickable node and font colors.

## Tokens — Colors

### Neutrals

| Name | Value | Token | Role |
|------|-------|-------|------|
| Neutral White | `#ffffff` | `--neutral-white` | Surfaces that sit on the canvas: modal, sidebar, panel, settings card, palette popover, hotkey toast. |
| Neutral Light Grey | `#f7f7f7` | `--neutral-light-grey` | Page canvas, sidebar item hover/active wash, kbd background, editable-heading hover. |
| Neutral Grey | `#e5e5e5` | `--neutral-grey` | Hairline borders on surfaces, inputs, share row, toolbar, hotkey toast. |

### Brand Accent

| Name | Value | Token | Role |
|------|-------|-------|------|
| Main Orange | `#fb5305` | `--main-orange` | Ember accent. Section eyebrows, sidebar section titles, active sidebar bullet, "+ New graph" hover, active tool-button outline. Outline-only — never used as a button fill. |

### Status Families

Each hue has a light / medium / strong tier. Light is the default tier for swatch-style backgrounds; strong is used for typographic accents and outlines.

| Family | Light | Medium | Strong |
|--------|-------|--------|--------|
| Orange | `#ffe3c8` `--orange-light` | `#fead81` `--orange-medium` | `#fe7233` `--orange-strong` |
| Purple | `#f8e5fd` `--purple-light` | `#efd6ff` `--purple-medium` | `#a45fff` `--purple-strong` |
| Green  | `#deffe3` `--green-light`  | `#beecd1` `--green-medium`  | `#49ca80` `--green-strong`  |
| Blue   | `#e2f9ff` `--blue-light`   | `#95daf5` `--blue-medium`   | `#43ace6` `--blue-strong`   |
| Red    | `#ffd6c4` `--red-light`    | `#e27f6e` `--red-medium`    | `#ef3230` `--red-strong`    |
| Yellow | `#fef0bf` `--yellow-light` | `#f6e5a5` `--yellow-medium` | `#f6c53e` `--yellow-strong` |

### Typographic Slate Family

A cool blue-grey neutral ramp for text. Default body text is `--color-deep-slate`; modal headings step up to `--color-midnight-ink` for emphasis.

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#000000` | `--color-midnight-ink` | Modal heading, panel heading, settings heading. |
| Graphite Nav | `#24272d` | `--color-graphite-nav` | Sidebar item label, input value, settings item, visibility row text. |
| Deep Slate | `#3a475a` | `--color-deep-slate` | Default canvas text on the cytoscape graph. |
| Storm | `#4a5465` | `--color-storm` | Body color, modal paragraph, sidebar "+ New graph" label, toolbar text. |
| Steel | `#717286` | `--color-steel` | Subtitle metadata, share hint, secondary captions. |
| Slate | `#748297` | `--color-slate` | Outlined Slate Pill default border + label color. |
| Ash | `#afb5c1` | `--color-ash` | Placeholder text, empty-state copy, default edge color. |
| Chalk | `#a6a8aa` | `--color-chalk` | Reserved for future low-emphasis chrome. |

### Semantic Colors — the layer components actually use

The semantic layer gives each role a stable name; theme switching rebinds the names without touching component CSS. Three groups of role tokens live here:

**Brand + interactive aliases** — named-role tokens that re-point to reference tokens per theme.

| Token | Maps to (light) | Used for |
|-------|-----------------|----------|
| `--color-ember-orange` | `--main-orange` | Brand accent (outline-only). Eyebrows, active sidebar bullet, active tool outline. |
| `--color-cobalt-link` | `--purple-strong` | Filled chromatic interactive: focus rings, checked checkbox, link URL, rubber-band selection. |
| `--color-canvas-white` | `--neutral-light-grey` | Page canvas. |
| `--color-pure-white` | `--neutral-white` | Surfaces (modal, sidebar, panel, popovers, hotkey toast). |
| `--color-blush-tint` | `--neutral-light-grey` | Hover / active item wash. |
| `--color-mist` | `--neutral-grey` | Hairline borders. |
| `--red` | `--red-strong` | Conventional warning red (private warn, destructive button). |

**Typographic Slate Family** — already enumerated in *Typographic Slate Family* above. These are semantic tokens too (`--color-midnight-ink`, `--color-graphite-nav`, `--color-deep-slate`, `--color-storm`, `--color-steel`, `--color-slate`, `--color-ash`); they're declared directly with hex values instead of via reference aliases because their roles map 1:1 to specific text-color jobs.

**Status-family raw tokens used directly** — components reach into the reference layer for these because they ARE the role: `--green-strong` for the Save/Confirm pill, `--red-strong` for Delete/Rotate, `--orange-strong` / `--orange-medium` / `--orange-light` and their purple/blue/green/red/yellow siblings for the user-pickable swatches.

**Task-status semantic tokens** — the four task statuses (`todo` / `in_progress` / `review` / `done`) each have a `stroke` and `fill` token. These are the single source of truth for status visuals across **both** the graph view (cytoscape node fills + borders) and the kanban view (column title color + flash backgrounds). Change a value here and both views update with no JS edits. Palette rotated 2026-05-15 to emphasize "warm = active, calm = ready, settled = done":

| Token | Value | Role |
|---|---|---|
| `--status-todo-stroke` | `var(--color-storm)` | Neutral grey — todo column title; no fill (default body text on plain canvas). |
| `--status-in-progress-stroke` | `#e88a1b` | Warm amber — "actively working". |
| `--status-in-progress-fill` | `#ffe7c5` | Soft amber wash for backgrounds + flash. |
| `--status-review-stroke` | `#49ca80` | Calm green — "ready for sign-off, awaiting another set of eyes". |
| `--status-review-fill` | `#deffe3` | |
| `--status-done-stroke` | `#4f46e5` | Settled indigo — "complete, archived". Visually distinct from active amber + ready-state green so finished work recedes. |
| `--status-done-fill` | `#e0e7ff` | |

Note: in_progress amber + done indigo are **independent of the orange/green/blue/yellow/red/purple status families** above. The status-family tokens are for user-pickable node and font colors (swatches in the appearance picker); the `--status-*-stroke/fill` tokens are for the system's own task-status semantics. They happened to overlap before May 15 but are now decoupled — don't substitute one for the other.

The graph view's cytoscape `style` array can't take CSS variables directly (it's a JS object), so `statusPalette()` in `public/app.js` reads the tokens via `getComputedStyle(document.documentElement)` at boot and feeds them in. As long as you touch these tokens (not the JS), both views stay in sync.

**Note — the E15 schema is intentionally not visualized.** The E15 universal-schema fields (node `significance` / `confidence` / `verified_at` / `type`, and the edge `purpose`) are an agent- and query-facing data concern, not a visual one: by design they get **no canvas rendering**. The graph view still draws off task `status` (the `--status-*` tokens above) and the **derived** edge `type` (`dependency` vs `related`) — a `supports`, `contradicts`, `related to` or `supersedes` edge all render as a `related` edge today. If these are ever surfaced visually (e.g. a distinct stroke for `contradicts`, or a visible succession arrow for `supersedes`), that's a new design decision to spec here first. `supersedes` (E18.4) joined that list deliberately: the canvas's only purpose-aware code is write-side (`typeToPurpose` in `public/app.js`), so the canvas cannot author one — which is correct, it is an agent/analyst relation.

**Picking a color token (decision order):**

1. If the role is in the *Brand + interactive aliases* table above, use that name.
2. If you need a text color, use a Typographic Slate Family token (see that section for the role each one carries).
3. If you need a constructive/destructive button color, use `--green-strong` / `--red-strong` directly.
4. If you need a task-status hue (column title / status flash / cytoscape node), use the `--status-*` tokens above. **Never** substitute a status-family token (`--green-strong` etc.) — that drifts the two views apart.
5. If you need a status hue for a chip / swatch / fill that is NOT a task status, reach into the status families directly (`--{color}-{light|medium|strong}`).
6. If none of the above fits, the design system is missing a token — add a semantic alias rather than hardcoding a hex.

## Tokens — Typography

Four typefaces, each with a clear role. Typeface choice does the hierarchy work — weight contrast within a family is minimal.

> **Typography is theme-invariant.** A theme is a *palette*: it decides what colour things are, never what typeface or size they are. All four `--font-*` faces, both size scales (`--text-*` chrome, `--prose-*` reading) and the leading/tracking tokens are declared **once** in the base `:root` and are identical in light and dark — only the colours they render in change. This was previously false: the dark block re-pointed all four faces to Helvetica Neue, collapsing the whole type system to a single sans, and duplicated both size scales so they could drift. `tests/theme-blocks-are-colour-only.test.js` fails the build if a typography token reappears inside a `[data-theme]` block, and asserts every weight the CSS uses is actually requested from Google Fonts (an unloaded weight gets synthesised into smeared letterforms rather than the real cut).
>
> The one category still deliberately theme-scoped is **shape** (`--radius-*`, `--r-*`): dark is flat (4px buttons) where light is round (100px pills). That's the same category error, but unifying it restyles every button and card, so it's a design decision rather than a cleanup — the test tracks it as a named exception rather than letting it spread.

### Playfair Display — Display headings · `--font-display`
- **Stack:** `'Playfair Display', 'EB Garamond', Garamond, 'Times New Roman', serif`
- **Weights:** 400
- **Sizes:** 22px (empty state), 24px (settings), 28px (modal h3, panel h2)
- **Letter spacing:** -0.04em (modal/panel) · -0.02em (empty state)
- **Role:** Modal headings, panel headings, settings card heading, empty-state cue. Always weight 400 — the typeface carries the emphasis, not the weight.

### Nunito — Eyebrows + Pill labels · `--font-label`
- **Stack:** `'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Weights:** 600
- **Sizes:** 14px / `--text-body` (eyebrows, modal action pill label), 12px (small pill label)
- **Letter spacing:** 0.125em (eyebrows) · 0.053em (pill labels)
- **Case:** UPPERCASE
- **Role:** Section eyebrows, sidebar section titles, all uppercase pill button labels.

### DM Sans — Body + Captions · `--font-body`
- **Stack:** `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Weights:** 400
- **Sizes:** 12px (toolbar text, sidebar meta), 13px (modal paragraph, share hint), 15px (body text), 16px (default body)
- **Line height:** 1.55
- **Role:** Modal paragraphs, share hints, toolbar captions, sidebar meta, modal body text.

### Inter — UI controls · `--font-ui`
- **Stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Weights:** 500
- **Sizes:** 13px (tool button, hotkey toast), 14px (settings item, appearance label), 15px (modal input, sidebar item, visibility row)
- **Role:** Form inputs, sidebar list items, toolbar buttons, settings list, default per-graph canvas font.

### Type Scale

Five canonical size tokens. Pick the one whose role matches; don't hardcode `px`.

| Token | Size | Role |
|-------|------|------|
| `--text-meta` | 11px | Chips, kbd hints, very small captions, modal subtitle metadata. |
| `--text-body-sm` | 13px | Member rows, picker option values, dense modal copy, secondary form text. |
| `--text-body` | 14px | Form labels (Mode / Font), picker triggers, section eyebrows, pill button labels. |
| `--text-section` | 15px | Available but currently unused — was the larger eyebrow variant, kept as a token in case the design returns to it. |
| `--text-heading` | 22px | Modal h3 (generic — Confirm delete, Create Edge, Defaults, etc.), panel title. |
| `--text-heading-lg` | 24px | Graph-edit modal title (`.editable-heading`) — one step above the generic modal h3 because it's the main "this is the thing you're editing" headline. |

**Legacy aliases** (kept so older callers don't break — prefer the canonical name in new code):

| Alias | Resolves to |
|-------|-------------|
| `--text-caption` | `--text-body-sm` (13px) |
| `--text-subheading` | `--text-body` (14px) |
| `--text-heading-sm` | `--text-heading` (22px) |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable (smaller scale than the dark cron reference; this surface holds inputs and lists, not landing-page hero blocks).

### Spacing Scale (theme-invariant)

| Name | Value | Token |
|------|-------|-------|
| 1 | 4px  | `--space-1` |
| 2 | 8px  | `--space-2` |
| 3 | 12px | `--space-3` |
| 4 | 16px | `--space-4` |
| 5 | 20px | `--space-5` |
| 6 | 24px | `--space-6` |
| 8 | 32px | `--space-8` |

### Border Radius

| Element | Token | Value |
|---------|-------|-------|
| Small / generic | `--radius-md` | 12px |
| Form inputs, share row | `--radius-cardsalt` | 12px |
| Modal, settings card, palette popover | `--radius-cards` | 16px |
| All buttons (pill) | `--radius-buttons` | 100px |
| Tag chip | `--radius-tags` | 36px |
| Fully round | `--radius-full` | 9999px |

### Shadows

Cool grey, soft, low-spread. No black, no chromatic tint — elevation should feel like paper lifting, not glow.

```
--shadow-sm: rgba(140, 142, 151, 0.32) 0 4px 7px -4px;
--shadow-md:
  rgba(140, 142, 151, 0.32) 0 4px 7px -4px,
  rgba(140, 142, 151, 0.16) 0 12px 24px -8px;
```

### Layout

- **Sidebar width:** 240px
- **Panel width:** 600px (resizable, min 320px, max 95vw)
- **Modal padding:** 32px
- **Modal max-width (form):** 520px

### Form-Modal Rhythm

Three vertical-gap levels inside a form modal (e.g., the graph-edit modal). The hierarchy makes the title→first-row gap visibly larger than the row→row gap, the way a typeset document structures headings.

| Role | Token | Value | Applies to |
|------|-------|-------|------------|
| After a title or eyebrow | `--space-5` | 20px | h3 → first field; section eyebrow → first row |
| Between rows inside a section | `--space-2` | 8px | sibling form rows / flush fields in the same group |
| Between distinct sections | `--space-8` | 32px | section → next section |

Implementation notes:

- The graph-title `h3` introduces an implicit "top section" — its `--space-5` bottom margin starts the rhythm. The flush rows beneath (Description, share-URL) live in that section and use the 8px gap.
- When a flush row group is followed by a real section (e.g., share-URL → Access), the section's `margin-top: --space-8` collapses with the flush row's `margin-bottom: --space-2` and the larger value wins — restoring the section-break gap.
- Sub-blocks inside a section (e.g., the members-list region inside Access, or the Text/Background color row inside Appearance) carry an extra `margin-top: 4px` so the gap above them reads as 12px — a hair more breathing room than a plain row-to-row gap, signalling that the sub-block groups its own children.

## Components

### Outlined Slate Pill (default modal button — Cancel / Dismiss / Reset / Clear)
**Role:** Interactive — secondary

Background: transparent. Text + border: Slate (`#748297`). Border radius: 100px (`--radius-buttons`). Padding: 10px 22px. Font: Nunito 600, 14px, UPPERCASE, letter-spacing 0.053em. Hover: text + border darken to Graphite Nav (`#24272d`). Active press: scale(0.96), 120ms cubic-bezier(0.2, 0, 0, 1).

### Outlined Green Pill (primary CTA — Save / Confirm)
**Role:** Interactive — constructive

Same shape as Slate Pill. Border + text: `--green-strong` (`#49ca80`). Hover: 10% green-strong fill via color-mix; text + border stay green-strong. Use exactly one per modal, paired with Slate (Cancel) or Red (Delete).

### Outlined Red Pill (danger — Delete / Rotate)
**Role:** Interactive — destructive

Same shape as Slate Pill. Border + text: `--red` / `--red-strong` (`#ef3230`). Hover: 10% red fill via color-mix.

### Section Eyebrow
**Role:** Typographic label

Nunito 600, 14px (`--text-body`), UPPERCASE, letter-spacing 0.125em, color `--color-ember-orange`. Sits above a section group inside a modal. Use sparingly — one per section, only when the controls below aren't self-evident from a placeholder. Bottom margin: 20px (`--space-5`) — see *Form-Modal Rhythm* below for the surrounding vertical structure.

### Modal Heading (inline-editable)
**Role:** Heading

Playfair Display, 28px, weight 400, line-height 1.1, letter-spacing -0.04em, color `--color-midnight-ink`. Inline-editable: subtle blush-tint background on hover/focus, 6px radius, 2px 6px padding offset to the left so the text baseline stays stationary. Empty state shows the `data-placeholder` attribute in `--color-ash`.

### Modal Subtitle (metadata)
**Role:** Caption

DM Sans, 13px, color `--color-steel`, `font-variant-numeric: tabular-nums` so timestamps don't reflow.

### Form Input
**Role:** Interactive — entry

Background: `--color-pure-white`. Border: 1px `--color-mist` (`#e5e5e5`). Border radius: 12px (`--radius-cardsalt`). Padding: 10px 14px. Font: Inter 15px, color `--color-graphite-nav`. Placeholder: `--color-ash`. Focus: border `--color-cobalt-link`, 3px box-shadow ring at 18% cobalt opacity.

### Custom Checkbox
**Role:** Interactive — toggle

14px square, 1px `--border-strong` (`--color-ash`) border, 3px radius. Checked: filled `--color-cobalt-link`, white SVG checkmark inset. Hit area extended to ~24px via invisible `::before`.

### Color Swatch
**Role:** Selection chip

22px square (modal appearance picker) or 28px (palette popover), 1px `--color-mist` border, 4px radius. 5-column grid, 6px gap (modal) / 12px gap (popover). Active state: 2px `--color-graphite-nav` outset ring.

### Tool Button (toolbar)
**Role:** Interactive — toolbar action

Inter 500, 13px. Padding 6px 12px. Default: transparent background + transparent border, color `--color-storm`. Hover: `--color-blush-tint` background. Active (selected): transparent background, `--color-ember-orange` border + text.

### Sidebar Item
**Role:** Navigation row

Padding 10px 20px. Label: Inter 500, 15px, letter-spacing -0.01em, color `--color-graphite-nav`. Meta: DM Sans 12px, `--color-steel`, tabular-nums. Hover + active: `--color-blush-tint` wash. Active row: 6px ember bullet at the left edge (`::before`).

### Hotkey Hint Toast
**Role:** Floating ephemeral notice

Floats top-center. `--color-pure-white` background, 1px `--color-mist` border, 100px pill, Inter 500 13px, `--color-graphite-nav`, `--shadow-sm`.

### Reader Mode (E16)
**Role:** A calm long-form reading lens over a graph's report

Reader mode is a **client-only third canvas view**, toggled from the sidebar header with a Phosphor `ph-book` / `ph-book-open` glyph (the two-glyph ember-tint swap used by the presence eye). It occupies the same region as `#cy` / `#kanban` — `applyView()` flips which is visible — and its on/off state lives in `localStorage` (not a server graph pref like kanban). Toggling and reading perform **zero graph writes**; the report renders through the same Toast UI Viewer (bundled sanitizer) the node editor uses, never via `innerHTML`.

- **Reading column.** A single centered measure, `max-width: 68ch`, over `--color-canvas-white`, 80px top clearance for the presence chrome. Title in Playfair Display, description + "Updated MM/DD/YY" meta in DM Sans / Inter greys, a hairline `--color-mist` rule under the header.
- **Contents rail.** An auto table of contents (h2–h4) fixed in the left margin with scroll-spy — the entry nearest the top takes an ember left-border + ember text (the active-tool treatment); other entries sit in `--color-steel`. Hidden below ~1280px (reading-first) and when a report has fewer than two headings. The section being read is also the URL: a Contents click pushes `#<heading-id>` onto the bar (`/g/<gid>?view=reader#references`), the scroll-spy keeps it current with `replaceState`, and opening such a link lands on that section once the report renders. Back/Forward step between sections. A just-clicked or deep-linked section stays active while its scroll settles, so the last section (which may never reach the top of the viewport) keeps the hash the reader asked for.
- **Staleness banner.** When the graph changed after the report was generated, a low-key amber note (ember left-border on `--color-blush-tint`) sits above the body. Copy is capability-aware: an editor is invited to regenerate; a read-only / anon viewer sees a plain "may be out of date". Same rule governs the empty state ("No report yet" — with the "ask your agent to generate one" CTA only for editors).
- **Cross-graph rail.** In reader mode the sidebar's graph list is swapped for a report browser — one row per graph (owned or member) that has a report, reusing the `.sb-item` row with an amber `.sb-dot` on stale reports. Clicking a row loads that report without repointing the active graph.
- **Citation hover card.** A cited node's title + description, its source URL when the node body has one (cobalt link, single-line truncated — a source with no URL is normal, and the row is simply absent), and an ember "Click to open the node →" hint. The card is **interactive**, not a passive tooltip: it holds a real outbound link, so it takes pointer events and stays open for a beat after the pointer leaves, letting you reach the URL.

### Node Page (single-node permalink)
**Role:** One node, read on its own — the landing surface for any shared node link

`/g/<gid>?node=<id>` — the ONE node-link shape (the old `/n/` path 301-redirects) — served as a **standalone page** (`public/node.html`), not a view of the SPA. A shared node link always opens here, whatever view the sender was in; `&view=graph` is the same node opened in the SPA canvas, selected. It exists because showing one node used to cold-boot the entire app — cytoscape, the 534KB editor bundle, the graphs list, the graph, SSE, presence — and paint three visible stages first. This renders off a single API read with no canvas at all.

- **Same reading voice as the report.** Deliberately reuses the reader's measure and type scale (68ch, Playfair title, DM Sans body) so arriving from a citation feels like turning a page, not switching apps. It loads the Toast UI **viewer** bundle (141KB JS / 10KB CSS) rather than the editor's (534KB / 165KB); both emit `.toastui-editor-contents`, which is what makes the typography match for free instead of being re-implemented.
- **Mode actions (top).** Quiet Inter 13px text links with 15px Phosphor glyphs, `--tx-3` resting → ember on hover: "Open graph" (`ph-graph`) always; "Open report" (`ph-book-open`) only when the graph's report actually **cites** this node — derived from the report's own `[[cite:]]` markers, never from navigation history, so a cold-pasted link and a citation click get the identical page.
- **Header.** Optional ember Section Eyebrow for the node's `type` (`reference`, `decision`) — the one meta field that changes how you read what follows. Then the title, description, and the **metadata list**: two semantic columns (one calm column under 520px) — left is what the node *is* (status, then the 0–1 scores), right is *when* things happened (the datetime fields together) — a fixed 16px glyph slot (the status dot in the shared `--status-*` colors for status; 15px Phosphor icons otherwise: `gauge` confidence, `star` significance, `seal-check` verified, `scales` decided, `clock` updated) then "Label: value" in Inter 13px `--tx-3`. Hover/focus on a row reveals a small **explainer tooltip** (pure CSS off `data-tip`, cite-tooltip surface: pure-white, mist border, `--radius-md`, `--shadow-md`, 12px `--tx-2`) that teaches what the field means — the reserved-field vocabulary is graph jargon a reader from a shared link has never met. Hairline rule beneath the list.
- **Connections.** The node's edges as text, grouped by how each reads *from this node's side* — an incoming `supports` is "Supported by", not "Supports". Evidence groups first, then dependency, then the catch-all. Each row links to that node's own permalink, so the graph is walkable without ever loading the canvas. Wiki-links in the body (`[[3417]]`, `[[external-id]]`) link the same way.

## Report Prose

**Role:** The design system extended into authored long-form content — report bodies and long node bodies.

Everything above governs app **chrome**. This section governs the **content** rendered inside it. The two are different problems: chrome is scanned and operated, prose is read at a 68ch measure, which is why prose gets its own scale rather than borrowing UI tokens whose roles are chips and form labels.

**Applies to both reading surfaces** — `#reader-body` (report) and `#node-body` (node permalink). Per *Node Page* above, the shared type scale is deliberate; author these rules once against both selectors, never duplicate them.

**Sanitizer constraint.** The Toast UI viewer runs every body through DOMPurify with `FORBID_TAGS` including `style`, `script` and `link`. Content therefore **cannot carry its own CSS** — but `div`, `span`, `figure`, `svg` and `class` all survive. Hence the fixed `gt-` class vocabulary: the design system owns the look, the author picks semantics. The authoring rules live in `.claude/skills/multitap/SKILL.md` § Report prose; `tests/report-prose-vocabulary.test.js` keeps the two in sync, and `tests/token-completeness.test.js` guards theme coverage.

### Prose Type Scale

Separate from the UI scale above, which stops at 24px and means different things.

| Token | Size | Role |
|-------|------|------|
| `--prose-h2` | 26px | Section heading. **Playfair Display 700**, tracking −0.01em, `text-wrap: balance`. The display serif already carrying the report title, so section breaks read editorially. |
| `--prose-h3` | 17px | Sub-heading. DM Sans 600. |
| `--prose-h4` | 15px | Minor heading. DM Sans 600, `--tx-2`. |
| `--prose-body` | 16px | Running text, DM Sans, leading `--prose-leading` (1.75). |
| `--prose-small` | 14px | Table cells, callout and card body. |
| `--prose-caption` | 13px | Captions, figcaptions, `<cite>`, code blocks. |
| `--prose-measure` | 68ch | The reading column. |

A body `h1` is deliberately unstyled — the report's title is chrome (`#reader-title`) and a second h1 would compete with it.

### Marks

- **Bold** — DM Sans 600. A defined term at first use, or the load-bearing number in a paragraph.
- *Italic* — a contrast the sentence pivots on.
- **Uppercase is reserved** for eyebrows, pills and table headers (the Nunito label language). Never in body prose — it would collide with the component vocabulary.
- Links: `--color-cobalt-link` with a 35% underline that solidifies on hover. Never ember — ember is the brand mark, not an interactive fill.
- List markers: ember `::marker`. Toast UI's own `::before` bullets are suppressed so this applies.

### Tables

Hairline `--border` row rules, no outer box (the `.gt-scroll` wrapper supplies it). Header row borrows the eyebrow language: **Nunito 600, `--text-meta`, UPPERCASE, 0.1em tracking, `--tx-3` on `--bg-3`**. Body cells 9px/14px, `font-variant-numeric: tabular-nums` so columns align. `caption` sits **below** the table in `--prose-caption` `--tx-3` and states the takeaway, not the column list. `.num` opts a cell into right-alignment.

Every table is wrapped in `.gt-scroll` — at a 68ch measure an unwrapped wide table scrolls the whole document.

### Chart Ramp

`--chart-1` … `--chart-6` are the **only** colors a figure may use, aliased onto the status families in maximum-separation order: ember, blue, green, purple, yellow, red. Plus `--chart-grid` (off `--border`) and `--chart-label` (off `--tx-3`).

Charts are **inline SVG only**. Inline SVG survives the sanitizer *and* reads CSS custom properties, so `stroke="var(--chart-1)"` recolors with the theme for free — no uploaded rasters, no per-theme variants, no second asset to keep in sync. A literal hex in a figure is a bug: it can only be right in one theme.

### Components

Namespaced `gt-` so nothing collides with Toast UI's classes.

#### Section Eyebrow (`.gt-eyebrow`)
Nunito 600, `--text-body`, UPPERCASE, 0.125em tracking, `--color-ember-orange` (`.muted` → `--tx-3`). `--space-5` below. Names what the section *is*. Same treatment as the modal Section Eyebrow, so the language is continuous between chrome and content.

#### Callout (`.gt-note`, `+ .warn` / `.key`)
`--bg-2` on a 1px `--border`, `--r-md`, 16px/20px padding, `--prose-small`. A 3px left border encodes severity: default `--tx-3` (aside), `.warn` `--yellow-strong` (changes how to read the section), `.key` `--color-ember-orange` (the finding). Inner `<p class="h">` is a Nunito uppercase `--text-meta` label in `--tx-3`.

#### Stat Row (`.gt-stats` › `.gt-stat`)
Auto-fit grid, `minmax(9.5em, 1fr)`, 1px gap over a `--border` ground so tiles share hairlines without doubling. Each tile: `.k` Nunito uppercase `--text-meta` `--tx-3`; `.v` **Playfair 700** at 1.6em with tabular numerals; `.s` `--prose-caption` `--tx-3`. `.up` / `.down` take `--green-strong` / `--red-strong` — semantic color, deliberately *not* the accent.

#### Pill (`.gt-pill`, `+ .good` / `.bad` / `.flag`)
Nunito 600 `--text-meta` UPPERCASE, 0.1em tracking, 2px/8px, `--radius-tags`, 1px `currentColor` border. Outline only — consistent with the outlined-pill button family.

#### Figure (`.gt-fig`) and Legend (`.gt-legend`)
`--bg-2` card, 1px `--border`, `--r-md`, `overflow-x: auto`. SVG is `display:block; max-width:100%`. `figcaption` `--prose-caption` `--tx-3` above a 0.75em gap. Legend is a flex row of `<span><i></i>label`, the `<i>` a 16×2.5px swatch in the series color.

#### Scroll Container (`.gt-scroll`)
`overflow-x: auto` with the border/radius/`--bg-2` the contained table doesn't draw itself. Inner table gets `min-width: 34em` so narrow tables still fill it.

#### Paired Cards (`.gt-cols.two` › `.gt-card`)
Single column, 14px gap, two columns above 720px. Card: `--bg-2`, 1px `--border`, `--r-md`, 18px/20px. `.h` is DM Sans 600 at `--prose-h4`. For genuinely paired content only — for/against, before/after — not a generic grid.

## Do's and Don'ts

### Do
- Use Playfair Display for h2 / h3 only. Body and controls stay in DM Sans / Inter.
- Use ember (`--color-ember-orange`) as a brand mark — section eyebrows, the active sidebar bullet, the active tool-button outline. Outline only.
- Use cobalt (`--color-cobalt-link`) as the only chromatic *fill* — focus rings, the checked checkbox, the link-colored share URL, the rubber-band selection.
- Use the outlined pill family (Slate / Green / Red) for every button. All buttons are 100px radius.
- Pair an outlined Green Pill (constructive) with either a Slate Pill (Cancel) or a Red Pill (Delete). Never two filled colored buttons.
- Use status families' light tier for swatches and surfaces, strong tier for typography and outlines.
- Use `font-variant-numeric: tabular-nums` for timestamps, share URLs, and any numeric value that updates in place.
- Use `text-wrap: pretty` on body paragraphs and `text-wrap: balance` on headings.
- Use cool-grey shadows (`rgba(140, 142, 151, …)`) — never black, never chromatic.

### Don't
- Don't fill ember as a button background. Ember is outline-only across this system.
- Don't introduce a chromatic color outside the six status families plus ember and cobalt.
- Don't use Playfair Display for body, captions, labels, or controls.
- Don't use Nunito anywhere except UPPERCASE eyebrows and pill button labels.
- Don't use sharp 4px corners on buttons — every button shape is a 100px pill.
- Don't drop heavy black shadows for elevation — the system relies on cool-grey, low-spread shadows.
- Don't ship a modal with a colored filled CTA. Constructive uses Outlined Green Pill.
- Don't reach past the slate-family neutrals for text; use Storm / Steel / Slate / Ash, not arbitrary greys.

## Elevation

Elevation is communicated by surface contrast (`--color-pure-white` floating on `--color-canvas-white`) and a soft cool-grey shadow, never by saturation or blur. `--shadow-sm` for one-step lifts (toolbar, hotkey toast); `--shadow-md` for modal-level lifts (modal, settings card, panel, palette popover). Hairline borders (`1px --color-mist`) reinforce edges so surfaces register on a near-white canvas without leaning on shadow alone.

## Imagery

This system has no marketing imagery. UI is the imagery: graph nodes on the cytoscape canvas, swatches in the modal, the sidebar list. Iconography is monochrome glyphs (Phosphor) at 14–18px, sitting in `--color-steel` or inheriting `currentColor`. There is no use of stock photography, illustration, or gradients.

## Layout

Three-region cockpit: a 240px left sidebar (collapses to 48px), a full-bleed cytoscape canvas, and a 600px right-side editing panel that slides in/out. Modals center over the canvas with a `rgba(0, 0, 0, 0.55)` scrim and animate in via a 12px translateY + opacity ramp over 0.7s on `cubic-bezier(0.19, 1, 0.22, 1)` — the "placed, not dropped" easing used throughout the system. Floating chrome (bottom toolbar, hotkey hint) is centered over the canvas region (offset by sidebar width), pill-shaped, with `--shadow-sm`.

## Motion

Two easings, each with one job:

- **Expressive ease (`cubic-bezier(0.19, 1, 0.22, 1)`, 0.7s)** — sidebar collapse/expand, panel open/close, modal enter. Fast-in, slow-out gives a placed-rather-than-dropped feel.
- **Press ease (`cubic-bezier(0.2, 0, 0, 1)`, 120ms)** — every interactive element scales to 0.96 on `:active`. Applied to modal buttons, sidebar icon buttons, sidebar bottom button, sidebar menu button, tool buttons, appearance clear, share row buttons.

Hover transitions are property-specific (color, border-color, background-color), 200ms `ease`. Never transition `all`.

## Agent Prompt Guide

1. Quick Color Reference:
   - Canvas: `#f7f7f7` (`--color-canvas-white`)
   - Surface: `#ffffff` (`--color-pure-white`)
   - Hairline: `#e5e5e5` (`--color-mist`)
   - Default text: `#3a475a` (`--color-deep-slate`)
   - Body text: `#4a5465` (`--color-storm`)
   - Heading: `#000000` (`--color-midnight-ink`)
   - Caption: `#717286` (`--color-steel`)
   - Brand mark (outline only): `#fb5305` (`--color-ember-orange`)
   - Filled chromatic accent: `#a45fff` (`--color-cobalt-link`)
   - Constructive: `#49ca80` (`--green-strong`)
   - Destructive: `#ef3230` (`--red-strong` / `--red`)

2. Example Component Prompts:
   - **Modal heading:** Playfair Display weight 400, 28px, line-height 1.1, letter-spacing -0.04em, color `--color-midnight-ink`. Inline-editable with blush-tint hover background, 6px radius, 2px 6px padding.
   - **Section eyebrow:** Nunito weight 600, 14px (`--text-body`), UPPERCASE, letter-spacing 0.125em, color `--color-ember-orange`. 20px margin below (`--space-5`).
   - **Outlined Green Pill (primary):** transparent background, 1px `--green-strong` border, `--green-strong` text, Nunito 600 14px UPPERCASE letter-spacing 0.053em, padding 10px 22px, border-radius 100px. Hover: 10% green-strong fill via color-mix. Active: scale(0.96), 120ms cubic-bezier(0.2, 0, 0, 1).
   - **Form input:** background `--color-pure-white`, 1px `--color-mist` border, 12px radius, padding 10px 14px, Inter 15px color `--color-graphite-nav`. Placeholder `--color-ash`. Focus: border `--color-cobalt-link` + 3px box-shadow at 18% cobalt opacity.
   - **Color swatch grid:** 5-column grid of 22px squares, 6px gap, 1px `--color-mist` border, 4px radius. Active state: 2px `--color-graphite-nav` outset ring.

## Similar Brands

- **mymind** — The closest reference: warm light canvas, serif display headlines over a multi-sans body stack, ember accent reserved as a brand mark, soft cool-grey shadows.
- **Things 3 (light)** — Comparable use of a four-typeface palette, soft elevation, and chromatic accents rationed to a single role each.
- **Linear (light mode)** — Similar approach to outlined chip-style buttons and a small, intentional set of status colors with light/medium/strong tiers.
- **Notion (light mode)** — Shared restraint with chromatic surfaces — neutral canvas, color used as a wash for tags rather than fills for buttons.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Neutrals */
  --neutral-white:      #ffffff;
  --neutral-light-grey: #f7f7f7;
  --neutral-grey:       #e5e5e5;

  /* Brand accent */
  --main-orange: #fb5305;

  /* Status — orange */
  --orange-light:  #ffe3c8;
  --orange-medium: #fead81;
  --orange-strong: #fe7233;

  /* Status — purple */
  --purple-light:  #f8e5fd;
  --purple-medium: #efd6ff;
  --purple-strong: #a45fff;

  /* Status — green */
  --green-light:  #deffe3;
  --green-medium: #beecd1;
  --green-strong: #49ca80;

  /* Status — blue */
  --blue-light:  #e2f9ff;
  --blue-medium: #95daf5;
  --blue-strong: #43ace6;

  /* Status — red */
  --red-light:  #ffd6c4;
  --red-medium: #e27f6e;
  --red-strong: #ef3230;

  /* Status — yellow */
  --yellow-light:  #fef0bf;
  --yellow-medium: #f6e5a5;
  --yellow-strong: #f6c53e;

  /* Slate-family neutrals (text) */
  --color-midnight-ink: #000000;
  --color-graphite-nav: #24272d;
  --color-deep-slate:   #3a475a;
  --color-storm:        #4a5465;
  --color-steel:        #717286;
  --color-slate:        #748297;
  --color-ash:          #afb5c1;
  --color-chalk:        #a6a8aa;

  /* Semantic role aliases */
  --color-ember-orange: var(--main-orange);
  --color-cobalt-link:  var(--purple-strong);
  --color-canvas-white: var(--neutral-light-grey);
  --color-pure-white:   var(--neutral-white);
  --color-blush-tint:   var(--neutral-light-grey);
  --color-mist:         var(--neutral-grey);
  --red:                var(--red-strong);

  /* Fonts */
  --font-display: 'Playfair Display', 'EB Garamond', Garamond, 'Times New Roman', serif;
  --font-label:   'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body:    'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-ui:      'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Type scale */
  --text-body-sm: 13px;
  --leading-body-sm: 1.55;
  --tracking-body-sm: normal;
  --text-caption: 15px;
  --leading-caption: 1.55;
  --text-body: 16px;
  --leading-body: 1.55;
  --text-subheading: 18px;
  --text-heading-sm: 28px;

  /* Spacing (theme-invariant) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Layout */
  --sidebar-w: 240px;

  /* Border radius */
  --radius-md: 12px;
  --radius-cardsalt: 12px;
  --radius-cards: 16px;
  --radius-buttons: 100px;
  --radius-tags: 36px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: rgba(140, 142, 151, 0.32) 0 4px 7px -4px;
  --shadow-md:
    rgba(140, 142, 151, 0.32) 0 4px 7px -4px,
    rgba(140, 142, 151, 0.16) 0 12px 24px -8px;
}
```

### Tailwind v4

```css
@theme {
  /* Neutrals */
  --color-neutral-white:      #ffffff;
  --color-neutral-light-grey: #f7f7f7;
  --color-neutral-grey:       #e5e5e5;

  /* Brand */
  --color-main-orange: #fb5305;

  /* Status — orange */
  --color-orange-light:  #ffe3c8;
  --color-orange-medium: #fead81;
  --color-orange-strong: #fe7233;

  /* Status — purple */
  --color-purple-light:  #f8e5fd;
  --color-purple-medium: #efd6ff;
  --color-purple-strong: #a45fff;

  /* Status — green */
  --color-green-light:  #deffe3;
  --color-green-medium: #beecd1;
  --color-green-strong: #49ca80;

  /* Status — blue */
  --color-blue-light:  #e2f9ff;
  --color-blue-medium: #95daf5;
  --color-blue-strong: #43ace6;

  /* Status — red */
  --color-red-light:  #ffd6c4;
  --color-red-medium: #e27f6e;
  --color-red-strong: #ef3230;

  /* Status — yellow */
  --color-yellow-light:  #fef0bf;
  --color-yellow-medium: #f6e5a5;
  --color-yellow-strong: #f6c53e;

  /* Slate text neutrals */
  --color-midnight-ink: #000000;
  --color-graphite-nav: #24272d;
  --color-deep-slate:   #3a475a;
  --color-storm:        #4a5465;
  --color-steel:        #717286;
  --color-slate:        #748297;
  --color-ash:          #afb5c1;
  --color-chalk:        #a6a8aa;

  /* Fonts */
  --font-display: 'Playfair Display', 'EB Garamond', Garamond, 'Times New Roman', serif;
  --font-label:   'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body:    'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-ui:      'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Type scale */
  --text-body-sm: 13px;
  --text-caption: 15px;
  --text-body: 16px;
  --text-subheading: 18px;
  --text-heading-sm: 28px;

  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;

  /* Border radius */
  --radius-md: 12px;
  --radius-cardsalt: 12px;
  --radius-cards: 16px;
  --radius-buttons: 100px;
  --radius-tags: 36px;
  --radius-full: 9999px;
}
```
