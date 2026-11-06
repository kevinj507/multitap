// A theme is a PALETTE. It decides what colour things are — never what
// typeface, size or spacing they are.
//
// This wasn't true before. `:root[data-theme="dark"]` redefined all four
// --font-* tokens to Helvetica Neue, so the whole type system — the Playfair
// display face, the Nunito label face, the DM Sans reading face — silently
// collapsed to a single sans in dark mode. Nothing errored; the fonts were
// simply wrong in one of the two themes, which is invisible unless you happen
// to be looking at the other one. Both size scales were duplicated across the
// theme blocks too, so a scale change had to be made twice or the themes drifted.
//
// Typography now lives once in the base :root. This guard keeps it there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../public/style.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function themeBlock(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`no ${selector} block`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < css.length; k++) {
    if (css[k] === '{') depth++;
    else if (css[k] === '}' && --depth === 0) return css.slice(open + 1, k);
  }
  throw new Error('unbalanced braces');
}

// Shape tokens (--radius-*, --r-*) still differ between themes: dark is flat
// (4px buttons) while light is round (100px pill buttons), a holdover from the
// two palettes this design descends from. That's the same category error as
// fonts were, but unifying it restyles every button and card in one theme, so
// it's a deliberate design decision rather than a cleanup — tracked, not
// silently allowed to spread. No NEW category may join this list.
const KNOWN_NON_COLOUR_EXCEPTIONS = /^--(radius|r)-/;

const THEME_BLOCKS = [':root[data-theme="dark"]', ':root[data-theme="light"]'];

describe('theme blocks change colour only', () => {
  it.each(THEME_BLOCKS)('%s declares no typography tokens', (selector) => {
    const body = themeBlock(selector);
    const offenders = Array.from(
      body.matchAll(/(^|[\s;])(--(?:font|text|prose)-[\w-]+)\s*:/g),
      (m) => m[2]
    );
    expect(
      [...new Set(offenders)].sort(),
      `${selector} must not redefine typography — declare it once in the base :root`
    ).toEqual([]);
  });

  it.each(THEME_BLOCKS)('%s declares no spacing or layout tokens', (selector) => {
    const body = themeBlock(selector);
    const offenders = Array.from(
      body.matchAll(/(^|[\s;])(--(?:space|sidebar)-[\w-]+)\s*:/g),
      (m) => m[2]
    );
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  it('keeps the non-colour exception list from growing', () => {
    const seen = new Set();
    for (const selector of THEME_BLOCKS) {
      for (const m of themeBlock(selector).matchAll(/(^|[\s;])(--[\w-]+)\s*:/g)) {
        const name = m[2];
        // Colour-ish tokens are the point of a theme block; anything else is
        // either an allowed exception or a new category error.
        if (/^--(color|bg|tx|ui|border|orange|purple|green|blue|red|yellow|cyan|magenta|status|chart|shadow|canvas|app-font|avatar|main|neutral)/.test(name)) continue;
        if (KNOWN_NON_COLOUR_EXCEPTIONS.test(name)) continue;
        seen.add(name);
      }
    }
    expect([...seen].sort(), 'new non-colour token in a theme block').toEqual([]);
  });

  it('defines the full type system exactly once, in the base :root', () => {
    const base = themeBlock(':root');
    for (const t of ['--font-display', '--font-label', '--font-body', '--font-ui']) {
      expect(base, `${t} belongs in the base :root`).toMatch(new RegExp(`${t}\\s*:`));
    }
    // The four faces must be four DIFFERENT faces — the dark-mode bug was that
    // they all resolved to the same one.
    const faces = ['--font-display', '--font-label', '--font-body', '--font-ui'].map(
      (t) => base.match(new RegExp(`${t}\\s*:\\s*([^;]+);`))[1].trim()
    );
    expect(new Set(faces).size, 'the four font roles must be four distinct stacks').toBe(4);
  });
});

describe('every weight the stylesheet asks for is actually loaded', () => {
  // A font-weight the webfont request doesn't include gets synthesised by the
  // browser — smeared, subtly wrong letterforms rather than the real cut.
  // Playfair 700 (report h2, stat values) and DM Sans 600 (sub-headings,
  // strong) were both used and both unloaded.
  const FAMILY_OF = { '--font-display': 'Playfair+Display', '--font-body': 'DM+Sans', '--font-label': 'Nunito', '--font-ui': 'Inter' };

  it.each(['index.html', 'node.html'])('%s requests 600 and 700 where the CSS uses them', (page) => {
    const html = readFileSync(fileURLToPath(new URL(`../public/${page}`, import.meta.url)), 'utf8');
    const link = html.match(/fonts\.googleapis\.com\/css2\?([^"]+)/)?.[1];
    expect(link, `${page} must link Google Fonts`).toBeTruthy();
    const weightsFor = (fam) => {
      const m = link.match(new RegExp(`family=${fam.replace(/\+/g, '\\+')}:wght@([0-9;]+)`));
      return m ? m[1].split(';') : [];
    };
    // Playfair carries the 700 report h2 + stat values; DM Sans the 600 h3/h4.
    expect(weightsFor(FAMILY_OF['--font-display'])).toContain('700');
    expect(weightsFor(FAMILY_OF['--font-body'])).toContain('600');
    expect(weightsFor(FAMILY_OF['--font-label'])).toContain('600');
  });

  it.each(['index.html', 'node.html'])('%s does not load fonts nothing references', (page) => {
    const html = readFileSync(fileURLToPath(new URL(`../public/${page}`, import.meta.url)), 'utf8');
    const link = html.match(/fonts\.googleapis\.com\/css2\?([^"]+)/)?.[1] ?? '';
    for (const fam of link.matchAll(/family=([A-Za-z+]+)/g)) {
      const name = fam[1].replace(/\+/g, ' ');
      expect(css, `${name} is fetched but never referenced in style.css`).toContain(name);
    }
  });
});
