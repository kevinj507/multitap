// Wiki-link tokenizer (node page). Pins the contract of public/node-links.js:
// [[3417]] and [[external-id]] refs split out of prose so node.js can turn
// them into permalink anchors, while the reader's [[cite:...]] markers and
// degenerate [[ ]] shapes pass through as plain text. Lossless: concatenating
// value/raw over the segments always reproduces the input.
import { describe, it, expect } from 'vitest';
import { splitWikiLinks } from '../public/node-links.js';

const rejoin = (parts) =>
  parts.map((p) => (p.type === 'text' ? p.value : p.raw)).join('');

describe('splitWikiLinks', () => {
  it('plain text yields one text segment', () => {
    expect(splitWikiLinks('no links here')).toEqual([
      { type: 'text', value: 'no links here' },
    ]);
  });

  it('a numeric ref splits out with numeric=true and its raw source', () => {
    expect(splitWikiLinks('the paired snapshots ([[3417]]) fully unattended')).toEqual([
      { type: 'text', value: 'the paired snapshots (' },
      { type: 'ref', ref: '3417', numeric: true, raw: '[[3417]]' },
      { type: 'text', value: ') fully unattended' },
    ]);
  });

  it('an external-id ref splits out with numeric=false', () => {
    const parts = splitWikiLinks('scoped as [[todo:fanout-claim-lease]].');
    expect(parts[1]).toEqual({
      type: 'ref', ref: 'todo:fanout-claim-lease', numeric: false, raw: '[[todo:fanout-claim-lease]]',
    });
  });

  it('inner whitespace trims for ref but raw keeps the source verbatim', () => {
    const parts = splitWikiLinks('see [[ 4112 ]] there');
    expect(parts[1]).toEqual({ type: 'ref', ref: '4112', numeric: true, raw: '[[ 4112 ]]' });
  });

  it('adjacent refs each split, nothing lost between them', () => {
    const parts = splitWikiLinks('[[1]][[mp-frontier]]');
    expect(parts.map((p) => p.type)).toEqual(['ref', 'ref']);
    expect(rejoin(parts)).toBe('[[1]][[mp-frontier]]');
  });

  it('reader citation markers stay plain text — the two systems never shadow', () => {
    expect(splitWikiLinks('claimed [[cite:12]] here')).toEqual([
      { type: 'text', value: 'claimed [[cite:12]] here' },
    ]);
    expect(splitWikiLinks('multi [[cite: 12, 34]] cite')).toEqual([
      { type: 'text', value: 'multi [[cite: 12, 34]] cite' },
    ]);
    // Case-insensitive, matching how defensively reader-cite is matched.
    expect(splitWikiLinks('[[CITE:9]]')[0].type).toBe('text');
  });

  it('empty and whitespace-only brackets stay plain text', () => {
    expect(splitWikiLinks('a [[]] b [[  ]] c')).toEqual([
      { type: 'text', value: 'a [[]] b [[  ]] c' },
    ]);
  });

  it('an unclosed [[ never eats the rest of the text', () => {
    expect(splitWikiLinks('dangling [[ and prose continues')).toEqual([
      { type: 'text', value: 'dangling [[ and prose continues' },
    ]);
  });

  it('a ref does not span lines', () => {
    expect(splitWikiLinks('x [[a\nb]] y')).toEqual([
      { type: 'text', value: 'x [[a\nb]] y' },
    ]);
  });

  it('null/undefined/empty input yields one empty text segment', () => {
    expect(splitWikiLinks(null)).toEqual([{ type: 'text', value: '' }]);
    expect(splitWikiLinks(undefined)).toEqual([{ type: 'text', value: '' }]);
    expect(splitWikiLinks('')).toEqual([{ type: 'text', value: '' }]);
  });

  it('is lossless over a mixed document', () => {
    const doc = 'Make the paired RH-vs-ours snapshots ([[3417]]) unattended —\n'
      + 'see the correction on [[4112]], the seed [[todo:edge-write-throughput]],\n'
      + 'a fence example `[[not touched by the DOM pass]]`, and [[cite:7]] stays.';
    expect(rejoin(splitWikiLinks(doc))).toBe(doc);
  });
});
