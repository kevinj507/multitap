// Every custom property must resolve in EVERY theme it can be reached from.
//
// This exists because it didn't. The six status hue families
// (--{orange,purple,green,blue,red,yellow}-{light,medium,strong}) were declared
// ONLY inside :root[data-theme="light"], while ten call sites outside that
// block used them with no fallback — including the Outlined Green Pill, the
// documented primary CTA. In dark mode `var(--green-strong)` is invalid at
// computed-value time, so `color`/`border-color`/`color-mix()` on Save and
// Confirm silently dropped. Nothing errors; the button just isn't green.
//
// The failure is invisible in a diff and invisible in whichever theme you
// happen to be developing in, which is exactly the kind of bug a test should
// hold. Fallback-bearing uses (`var(--x, #fff)`) are exempt: they resolve by
// construction.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Comments are stripped first: they sit between blocks, so leaving them in
// makes a selector read as "/* ... */ :root" and the base-:root match fail.
const css = readFileSync(fileURLToPath(new URL('../public/style.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Split the file into top-level blocks so we can ask which theme a declaration
// belongs to. Good enough for this stylesheet: it has no nested at-rules around
// the :root blocks.
function topLevelBlocks(src) {
  const blocks = [];
  let depth = 0;
  let start = null;
  let selStart = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      if (depth === 0) {
        blocks.push({ selector: src.slice(selStart, i).trim(), bodyStart: i + 1 });
        start = blocks.length - 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== null) {
        blocks[start].body = src.slice(blocks[start].bodyStart, i);
        selStart = i + 1;
        start = null;
      }
    }
  }
  return blocks.filter((b) => b.body !== undefined);
}

const blocks = topLevelBlocks(css);

// Tokens a theme provides = everything defined in the base :root plus that
// theme's own block. `:root, :root[data-theme="dark"]` counts for dark.
function definedFor(theme) {
  const names = new Set();
  for (const b of blocks) {
    const sel = b.selector;
    if (!sel.includes(':root')) continue;
    const isBase = /^:root$/.test(sel);
    const isDark = sel.includes('[data-theme="dark"]');
    const isLight = sel.includes('[data-theme="light"]');
    const applies =
      isBase ||
      (theme === 'dark' && isDark) ||
      (theme === 'light' && isLight) ||
      // `:root, :root[data-theme="dark"]` — the bare :root in the list makes it
      // the default, so it also applies to light unless light overrides.
      (sel.split(',').some((s) => s.trim() === ':root') && !isLight);
    if (!applies) continue;
    for (const m of b.body.matchAll(/(^|[\s;])(--[\w-]+)\s*:/g)) names.add(m[2]);
  }
  return names;
}

// Properties declared on a component rather than on :root (e.g. --avatar-glow,
// which carries a default on .presence-avatar and is overwritten per-element
// from JS). They're scoped to the subtree that sets them, so theme coverage
// isn't the right question — this guard is about THEME tokens.
const componentScoped = new Set();
for (const b of blocks) {
  if (b.selector.includes(':root')) continue;
  for (const m of b.body.matchAll(/(^|[\s;])(--[\w-]+)\s*:/g)) componentScoped.add(m[2]);
}

const THEMES = ['dark', 'light'];

describe('style.css custom properties resolve in both themes', () => {
  // Per-graph appearance overrides are set on elements from JS, never declared
  // in the stylesheet. Anything else must be declared.
  const RUNTIME_SET = new Set(['--graph-font', '--graph-font-color', '--graph-bg']);

  it.each(THEMES)('%s theme defines every token used without a fallback', (theme) => {
    const defined = definedFor(theme);
    const missing = new Map();

    for (const b of blocks) {
      // Uses inside a theme block only need to resolve in that theme.
      const sel = b.selector;
      if (sel.includes('[data-theme="light"]') && theme !== 'light') continue;
      if (sel.includes('[data-theme="dark"]') && theme !== 'dark' && !sel.split(',').some((s) => s.trim() === ':root')) continue;

      for (const m of b.body.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        const [, name, next] = m;
        if (next === ',') continue; // has a fallback
        if (RUNTIME_SET.has(name)) continue;
        if (componentScoped.has(name)) continue;
        if (defined.has(name)) continue;
        if (!missing.has(name)) missing.set(name, sel.slice(0, 60));
      }
    }

    expect(
      Object.fromEntries(missing),
      `tokens used with no fallback but undefined in the ${theme} theme`
    ).toEqual({});
  });

  it('defines the prose + chart scale in both themes', () => {
    const required = [
      '--prose-h2', '--prose-h3', '--prose-h4', '--prose-body',
      '--prose-small', '--prose-caption', '--prose-leading', '--prose-measure',
      '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6',
      '--chart-grid', '--chart-label',
    ];
    for (const theme of THEMES) {
      const defined = definedFor(theme);
      expect(required.filter((t) => !defined.has(t)), `missing in ${theme}`).toEqual([]);
    }
  });

  it('defines all six status families in both themes', () => {
    const families = ['orange', 'purple', 'green', 'blue', 'red', 'yellow'];
    const tiers = ['light', 'medium', 'strong'];
    for (const theme of THEMES) {
      const defined = definedFor(theme);
      const missing = [];
      for (const f of families) {
        for (const t of tiers) if (!defined.has(`--${f}-${t}`)) missing.push(`--${f}-${t}`);
      }
      expect(missing, `status families missing in ${theme}`).toEqual([]);
    }
  });
});
