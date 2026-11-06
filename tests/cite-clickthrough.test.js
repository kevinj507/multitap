// The reader's citation click-throughs. Every guard below covers one shape of
// failure: an element that LOOKS like a link — ember-coloured, or captioned
// "Click to open the node →" — but carries no href, so trying to follow it does
// nothing at all and raises no error anywhere. That is exactly how the hover
// card shipped: the hint was a bare <div>, and the card is deliberately
// pointer-reachable (it holds the cited source's URL), so the pointer was
// invited in and handed inert text telling it to click.
//
// The suite has no jsdom harness, so these read the source the way
// hidden-class-rules.test.js reads the stylesheet.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeHref } from '../public/route-parse.js';

const read = (p) => readFileSync(fileURLToPath(new URL(`../public/${p}`, import.meta.url)), 'utf8');

// Slice one top-level `function name(...) {...}` body out by brace-matching, so
// each guard reads only the function it names. Scoping matters here: the
// References list builds its own anchors with hrefs a few lines away, and a
// whole-file search would happily pass on those while the inline superscripts
// had none.
function functionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in app.js`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`function ${name} body is unterminated`);
}

// Given `foo.className = 'x'` or `foo.textContent = '...'`, return `foo`, then
// assert that same variable is an anchor carrying an href. Naming the element
// by what it renders keeps the guard about behaviour rather than about the
// exact lines that produce it.
function expectRealLink(body, ownerRe, label) {
  const owner = body.match(ownerRe);
  expect(owner, `could not find ${label} in the source`).toBeTruthy();
  const v = owner[1];
  expect(
    new RegExp(`${v}\\s*=\\s*document\\.createElement\\('a'\\)`).test(body),
    `${label} must be an <a>, not a non-interactive element`,
  ).toBe(true);
  expect(
    new RegExp(`${v}\\.href\\s*=`).test(body),
    `${label} must carry a real href`,
  ).toBe(true);
}

describe('reader citations are followable links', () => {
  const src = read('app.js');

  // The card says "Click to open the node →". It must be clickable to say so.
  it('the hover card\'s open-the-node hint is a real link', () => {
    expectRealLink(
      functionBody(src, 'showCiteTooltip'),
      /(\w+)\.textContent = 'Click to open the node/,
      "the tooltip's \"Click to open the node\" hint",
    );
  });

  // Without an href the superscript is a JS-only left-click target: cmd/ctrl
  // click, middle click, "Open link in new tab" and the status-bar URL preview
  // all silently do nothing.
  it('inline cite superscripts carry a real href, not just a click handler', () => {
    expectRealLink(
      functionBody(src, 'transformCitesInDom'),
      /(\w+)\.className = 'cite-ref'/,
      'an inline cite superscript',
    );
  });

  // The node permalink shape (/g/<gid>?node=<id>) is agreed across files that
  // never import each other at runtime: route-parse.js builds it, app.js's
  // citeNodeHref fallback re-types it for when the module shim didn't load,
  // and src/app.js's routing serves the reading page for exactly that shape.
  // If the fallback drifts, citations quietly start booting the SPA (or 404)
  // only for users whose RouteParse import failed — invisible in normal runs.
  it('the citation fallback href matches the permalink shape route-parse owns', () => {
    expect(nodeHref('g1', 7)).toBe('/g/g1?node=7');
    const body = functionBody(src, 'citeNodeHref');
    expect(
      body.includes('`/g/${encodeURIComponent(gid)}?node=${encodeURIComponent(id)}`'),
      'citeNodeHref fallback must re-type the exact nodeHref shape',
    ).toBe(true);
  });

  // The from= convention is retired (2026-08-07): the node page derives its
  // "Open report" affordance from the report's own citations, so navigation
  // history no longer needs to be smuggled through the URL. Keep it dead —
  // a reintroduction on one side only would silently do nothing.
  it('the retired from= convention stays retired on both sides', () => {
    expect(src).not.toMatch(/\?from=/);
    expect(read('node.js')).not.toMatch(/from === '/);
  });

  // Ember is the colour this app uses for citation links; wearing it without
  // the pointer cursor is the visual half of the same lie.
  it('the hint looks clickable', () => {
    const css = read('style.css');
    const rule = css.match(/\.cite-tip-hint\s*\{[^}]*\}/);
    expect(rule, '.cite-tip-hint rule not found in style.css').toBeTruthy();
    expect(rule[0]).toMatch(/cursor:\s*pointer/);
  });
});
