// The report component vocabulary has two halves that must not drift:
//
//   public/style.css                     — what actually renders
//   .claude/skills/multitap/SKILL.md    — what a drafting agent is told exists
//
// A report body cannot ship its own CSS (the reader's DOMPurify config forbids
// <style>), so a class the agent invents renders as an unstyled div and the
// failure is silent — the report just looks broken, with nothing in any log.
// The two lists are therefore asserted equal in both directions: a class in the
// skill with no rule would render bare, and a rule with no skill entry is dead
// CSS no author knows to reach for.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const css = read('../public/style.css');
const skill = read('../.claude/skills/multitap/SKILL.md');

// Base classes only — modifiers (.warn, .key, .up) and inner element hooks
// (.k/.v/.s/.h/.num) are documented in prose within the vocabulary table rather
// than as standalone rows.
const BASE = /\.(gt-[a-z-]+)/g;

function classesIn(text) {
  return new Set(Array.from(text.matchAll(BASE), (m) => m[1]));
}

describe('report prose vocabulary stays in sync', () => {
  const inCss = classesIn(css);
  // Only look at the vocabulary table in the skill, not incidental prose
  // mentions elsewhere in the file.
  const table = skill.slice(skill.indexOf('### The `gt-` vocabulary'), skill.indexOf('### Charts'));
  const inSkill = new Set(Array.from(table.matchAll(/`\.(gt-[a-z-]+)/g), (m) => m[1]));

  it('documents every gt- class the stylesheet defines', () => {
    expect([...inCss].filter((c) => !inSkill.has(c)).sort()).toEqual([]);
  });

  it('styles every gt- class the skill documents', () => {
    expect([...inSkill].filter((c) => !inCss.has(c)).sort()).toEqual([]);
  });

  it('covers the components the reader depends on', () => {
    for (const c of ['gt-scroll', 'gt-fig', 'gt-note', 'gt-stats', 'gt-eyebrow', 'gt-pill']) {
      expect(inCss.has(c), `${c} missing from style.css`).toBe(true);
      expect(inSkill.has(c), `${c} missing from SKILL.md`).toBe(true);
    }
  });

  it('applies the prose rules to BOTH reading surfaces', () => {
    // design/DESIGN.md § Node Page makes the shared type scale deliberate: a
    // citation click-through should feel like turning a page. A rule added for
    // #reader-body only would silently regress the node permalink.
    const readerOnly = [];
    for (const m of css.matchAll(/#reader-body ([.\w-]+[^,{]*)[,{]/g)) {
      const sel = m[1].trim();
      if (!/gt-|toastui-editor-contents/.test(sel)) continue;
      if (!css.includes(`#node-body ${sel}`)) readerOnly.push(sel);
    }
    expect(readerOnly.sort()).toEqual([]);
  });

  it('contains wide content instead of letting the page scroll', () => {
    // The reading measure is 68ch; .gt-scroll and .gt-fig are the containers
    // that keep a wide table or diagram from scrolling the whole document.
    for (const sel of ['.gt-scroll', '.gt-fig']) {
      const block = css.slice(css.indexOf(`#reader-body ${sel},`));
      expect(block.slice(0, 400), `${sel} must scroll internally`).toMatch(/overflow-x:\s*auto/);
    }
  });
});
