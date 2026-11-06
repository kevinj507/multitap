// Every var(--token) in the stylesheet has to actually resolve. An undefined
// custom property is not an error anywhere: the browser throws the whole
// declaration away and the property falls back to its inherited or initial
// value, so the element just renders wrong — grey where it should be ember,
// square where it should be rounded — with nothing logged and nothing to notice
// in the diff. Two shipped that way: `--color-ember` (a typo for the real
// `--color-ember-orange`) and `--radius-sm` (never defined in either theme).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../public/${p}`, import.meta.url)), 'utf8');

describe('style.css custom properties', () => {
  it('every token it uses is one it (or the app) actually defines', () => {
    const css = read('style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    // A few tokens are per-element and set at runtime instead of declared in
    // the sheet — a peer's cursor colour, a card's own colour.
    const js = ['app.js', 'node.js'].map(read).join('\n');
    for (const m of js.matchAll(/setProperty\(\s*'(--[\w-]+)'/g)) defined.add(m[1]);

    const missing = new Set();
    for (const [, token, next] of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
      // `var(--x, fallback)` degrades on purpose — that one is a choice.
      if (next === ',') continue;
      if (!defined.has(token)) missing.add(token);
    }
    expect([...missing]).toEqual([]);
  });
});
