// OKF export — ustar writer (src/tar.js). Pure unit tests assert the header
// format byte-by-byte; a guarded integration test round-trips the archive
// through the system GNU tar when one is installed.
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { tarball } from '../src/tar.js';

const BLOCK = 512;

// Read a NUL-terminated ASCII field out of a header block.
function field(buf, offset, len) {
  const raw = buf.subarray(offset, offset + len);
  const nul = raw.indexOf(0);
  return raw.subarray(0, nul === -1 ? len : nul).toString('ascii');
}

describe('tarball', () => {
  const files = [
    { path: 'index.md', content: '# Hello\n' },
    { path: 'tasks/1-first.md', content: 'body with émoji 🎉\n' },
  ];

  it('is block-aligned with a two-zero-block trailer', () => {
    const buf = tarball(files);
    expect(buf.length % BLOCK).toBe(0);
    expect(buf.subarray(buf.length - 2 * BLOCK).every((b) => b === 0)).toBe(true);
  });

  it('writes correct headers: name, size in bytes, typeflag, magic', () => {
    const buf = tarball(files, { mtime: 1724457600 });
    // First header at 0.
    expect(field(buf, 0, 100)).toBe('index.md');
    expect(parseInt(field(buf, 124, 12), 8)).toBe(Buffer.byteLength('# Hello\n'));
    expect(String.fromCharCode(buf[156])).toBe('0');
    expect(field(buf, 257, 6)).toBe('ustar');
    expect(buf.subarray(263, 265).toString('ascii')).toBe('00');
    expect(parseInt(field(buf, 136, 12), 8)).toBe(1724457600);
    // Second header follows the first entry's padded content: multibyte
    // content is sized in BYTES, not JS string length.
    const second = BLOCK + BLOCK; // 8-byte content pads to one block
    expect(field(buf, second, 100)).toBe('tasks/1-first.md');
    const emojiBytes = Buffer.byteLength('body with émoji 🎉\n');
    expect(parseInt(field(buf, second + 124, 12), 8)).toBe(emojiBytes);
  });

  it('stores a checksum that recomputes under the space-filled-field rule', () => {
    const buf = tarball(files);
    const stored = parseInt(field(buf, 148, 8).trim(), 8);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) {
      sum += i >= 148 && i < 156 ? 0x20 : buf[i];
    }
    expect(stored).toBe(sum);
  });

  it('is byte-deterministic for identical input', () => {
    expect(tarball(files).equals(tarball(files))).toBe(true);
  });

  it('throws on a path over 100 bytes instead of truncating', () => {
    const long = 'tasks/' + 'a'.repeat(101) + '.md';
    expect(() => tarball([{ path: long, content: 'x' }])).toThrow(/100 bytes/);
  });

  const haveTar = existsSync('/usr/bin/tar');
  it.skipIf(!haveTar)('lists and extracts with system tar', () => {
    const buf = tarball(files, { mtime: 1724457600 });
    const list = spawnSync('/usr/bin/tar', ['-tf', '-'], { input: buf });
    expect(list.status).toBe(0);
    expect(list.stdout.toString().trim().split('\n')).toEqual([
      'index.md',
      'tasks/1-first.md',
    ]);
    const extract = spawnSync('/usr/bin/tar', ['-xOf', '-', 'tasks/1-first.md'], { input: buf });
    expect(extract.status).toBe(0);
    expect(extract.stdout.toString('utf8')).toBe('body with émoji 🎉\n');
  });
});
