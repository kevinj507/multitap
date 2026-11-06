// E16.17 — the reader Contents rail's pure extractor. The DOM wiring (sticky
// nav + IntersectionObserver scroll-spy) is verified in the running app (the
// suite has no jsdom harness); this covers the shared, DOM-free logic: which
// headings become entries, fenced-code skipping, and duplicate-slug dedupe.
import { extractToc, slugify } from '../public/reader-toc.js';

describe('extractToc (E16.17)', () => {
  it('extracts h2–h4 only, excluding the h1 title and h5/h6', () => {
    const md = '# Title\n## A\n### B\n#### C\n##### D\n###### E\n';
    expect(extractToc(md).map((i) => [i.level, i.text])).toEqual([
      [2, 'A'], [3, 'B'], [4, 'C'],
    ]);
  });

  it('skips headings inside fenced code blocks (``` and ~~~)', () => {
    const md = '## Real\n```\n## Fake in code\n```\n~~~\n## Also fake\n~~~\n## Real2\n';
    expect(extractToc(md).map((i) => i.text)).toEqual(['Real', 'Real2']);
  });

  it('dedupes repeated heading slugs deterministically', () => {
    const md = '## Intro\n## Intro\n## Intro\n';
    expect(extractToc(md).map((i) => i.id)).toEqual(['intro', 'intro-1', 'intro-2']);
  });

  it('strips inline markdown marks from both the text and the id', () => {
    const [it] = extractToc('## **Bold** and `code`\n');
    expect(it.text).toBe('Bold and code');
    expect(it.id).toBe('bold-and-code');
  });

  it('ignores non-ATX lines and requires a space after the hashes', () => {
    expect(extractToc('##NoSpace\ntext ## not a heading\n')).toEqual([]);
  });

  it('returns [] for empty or heading-less input', () => {
    expect(extractToc('')).toEqual([]);
    expect(extractToc('just a paragraph\nand another line')).toEqual([]);
    expect(extractToc(null)).toEqual([]);
  });
});

describe('slugify (E16.17)', () => {
  it('lowercases, hyphenates, and strips punctuation', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  Spaced   Out  ')).toBe('spaced-out');
  });
  it('falls back to "section" when nothing survives', () => {
    expect(slugify('!!!')).toBe('section');
    expect(slugify('')).toBe('section');
  });
});

// Section deep links: the hash <-> heading-id plumbing behind
// /g/<gid>?view=reader#<section>. The scroll/pin behaviour is DOM and is
// verified in the running app; this covers the pure parse/format halves.
import { sectionIdFromHash, withSectionHash } from '../public/reader-toc.js';

describe('sectionIdFromHash (reader section deep links)', () => {
  it('reads a heading id out of a location.hash', () => {
    expect(sectionIdFromHash('#references')).toBe('references');
    expect(sectionIdFromHash('#the-history-of-the-idea')).toBe('the-history-of-the-idea');
    expect(sectionIdFromHash('#intro-2')).toBe('intro-2');
  });

  it('accepts the hash with or without its leading # and decodes percent-encoding', () => {
    expect(sectionIdFromHash('references')).toBe('references');
    expect(sectionIdFromHash('#part%5F1')).toBe('part_1');
  });

  it('returns null for an empty, missing or malformed hash', () => {
    expect(sectionIdFromHash('')).toBeNull();
    expect(sectionIdFromHash('#')).toBeNull();
    expect(sectionIdFromHash(null)).toBeNull();
    expect(sectionIdFromHash(undefined)).toBeNull();
    expect(sectionIdFromHash('#-leading-dash')).toBeNull();
    expect(sectionIdFromHash('#has space')).toBeNull();
    expect(sectionIdFromHash('#<script>')).toBeNull();
    expect(sectionIdFromHash('#%E0%A4%A')).toBeNull(); // bad percent-encoding
  });

  it('round-trips every id slugify can produce', () => {
    for (const text of ['References', 'Part 1 — how we got here', '**Bold** and `code`', 'Q&A: what next?']) {
      const id = slugify(text);
      expect(sectionIdFromHash(`#${id}`)).toBe(id);
    }
  });
});

describe('withSectionHash (reader section deep links)', () => {
  it('appends the section as the hash, keeping pathname and search as they are', () => {
    expect(withSectionHash('/g/abc123', '?view=reader', 'references'))
      .toBe('/g/abc123?view=reader#references');
    expect(withSectionHash('/g/abc123', '', 'intro')).toBe('/g/abc123#intro');
  });

  it('drops the hash entirely for a null or empty section', () => {
    expect(withSectionHash('/g/abc123', '?view=reader', null)).toBe('/g/abc123?view=reader');
    expect(withSectionHash('/g/abc123', '?view=reader', '')).toBe('/g/abc123?view=reader');
  });

  it('percent-encodes an id so the bar never holds a raw unsafe character', () => {
    expect(withSectionHash('/g/x', '', 'a b')).toBe('/g/x#a%20b');
  });
});
