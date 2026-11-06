# CLAUDE.md — Multitap orientation

Notes for future Claude sessions working in this repo. Keep brief; deeper
detail lives in the linked files.

## Layout at a glance

- `public/` — the entire client. Static assets served by Express. Vanilla
  JS; no build step, no bundler.
  - `index.html` + `app.js` — the SPA (graph / kanban / reader views).
    Nearly all client JS lives in `app.js`.
  - `node.html` + `node.js` — a **second, standalone page** at
    `/g/<gid>?node=<id>` (the ONE node-link shape; the old `/n/<id>` path
    301-redirects here): one node's markdown plus its edges, rendered off a
    single API read with no cytoscape and no editor bundle. Citation
    click-throughs and wiki-links land here. Adding `&view=graph` opens the
    SPA canvas with the node selected instead — that's what the page's "Open
    graph" action mints and what the canvas keeps in the bar while a node is
    selected. Deliberately NOT part of the SPA — the whole point is not
    paying the app's boot cost to read one node. Loads the Toast UI *viewer*
    bundle, not the editor one.
  - `style.css` — **all** CSS for **both** pages (tokens + components).
    One file, ~3000 lines.
  - The small pure ES modules (`reader-*.js`, `route-parse.js`,
    `search-*.js`) are the shared, unit-tested logic: the browser hangs
    them on `window.*` via a `<script type="module">` shim in
    `index.html`, and vitest imports them directly. Put testable logic
    here rather than in `app.js`.
- `src/` — Node/Express server (auth, graphs, SSE, REST endpoints).
- `db/` — schema + migrations. Postgres.
- `design/DESIGN.md` — prose design spec (see below).
- `tests/` — vitest, run with `npm test`.

## Design system — where things live

**Source of truth: `public/style.css`.**

- **`.hidden` is an INERT marker class.** `style.css` declares `.hidden {}`
  empty on purpose; each component supplies its own
  `#thing.hidden { display: none; }`. Ship an element with
  `class="hidden"` and no such rule and it is simply *visible*, silently —
  that's how the "No report yet" placeholder ended up pinned under every
  rendered report. `tests/hidden-class-rules.test.js` now fails the build
  on a missing rule; add yours when you add the markup.
- The top of the file declares every CSS custom property the app uses:
  `--space-*`, `--text-*`, `--color-*`, `--font-*`, `--radius-*`,
  `--shadow-*`. Both `light` and `dark` themes redefine the full token
  set (see the comment at the top of the file).
- **Two token layers** coexist in that file:
  - *Reference* tokens — raw values: `--neutral-white`, `--main-orange`,
    `--orange-light/medium/strong`, etc. Declared once per theme.
  - *Semantic* tokens — role-based aliases: `--color-pure-white`,
    `--color-ember-orange`, etc. These alias the reference tokens and
    are what component CSS should use. Re-pointing a semantic alias is
    how themes change a role's value without touching components.
- Below the tokens, the rest of the file is component CSS organized
  loosely by region (sidebar → canvas → panel → modal → toast → etc.).
- There is no build step. The HTML `<link>`s `style.css` directly.

**Prose spec: `design/DESIGN.md`.**

- Documents the design language: color roles, type stack, spacing
  rhythm, component patterns. Read this when you need to know *what*
  the design intends, not *how* it's implemented.
- Notable sections:
  - **Foundations → Spacing Scale** — the eight `--space-*` primitives.
  - **Foundations → Form-Modal Rhythm** — the 20px/8px/32px gap
    hierarchy for vertical structure in form modals.
  - **Components** — visual + behavioral spec for each reusable piece
    (eyebrows, pills, swatches, etc.).

There used to be `design/variables.css`, `design/theme.css`, and
`design/tokens.json` here too. They were stale snapshots — never loaded
by the app, and their token names had drifted from the real CSS. They
were deleted; don't recreate them.

## Working in the design system

When you change visual styles:

1. **Edit `public/style.css`.** That's the live system.
2. **If the change is a new pattern, a new token, or a deviation from
   an existing rule, update `design/DESIGN.md`** so the next session
   knows the rule. Small tweaks (pixel nudges, single-component
   adjustments) don't need a doc update.
3. **Don't add new CSS files under `design/`** unless you're also wiring
   them up in `index.html` and updating this file. Drifting reference
   files are how this project got in a confusing state before.

When you want to know "is there a token for this?":

- Search the top of `style.css` for the relevant prefix
  (`--space-`, `--text-`, `--color-`, `--font-`).
- If the value you want isn't a token, prefer adding a token over
  hardcoding — but only when the value will be reused. One-offs can be
  literal.

## Runtime (development)

The app is supervised by the workspace gateway; see the workspace-level
`CLAUDE.md` at `/data/workspace/CLAUDE.md` for the deploy / inspect /
register flows. The app should already be running on port 3000 in this
session.

## Memory

There are several user-memory entries about working on this project at
`/data/claude-home/.claude/projects/-data-workspace/memory/` — UI
patterns, auth gotchas, deferred work. Check `MEMORY.md` there when you
need historical context.
