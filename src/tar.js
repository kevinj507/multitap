// Minimal ustar (POSIX.1-1988 tar) writer for the OKF export. Hand-rolled on
// purpose: the project's dependency footprint is deliberately tiny, the bundle
// is small markdown text built fully in memory, and plain tar is
// byte-deterministic (unlike gzip, whose header embeds OS/mtime bytes) —
// which keeps the export snapshot-testable. Streaming/gzip are the escalation
// paths if bundles ever outgrow RAM; don't build them speculatively.
//
// Scope: regular files only, ASCII-safe paths ≤ 100 bytes (the classic ustar
// `name` field; no `prefix` splitting). The OKF exporter guarantees this by
// construction (slugs are [a-z0-9-], paths ≤ 80 bytes) and this module throws
// rather than silently truncating if that invariant is ever broken.

const BLOCK = 512;

// One 512-byte ustar header for a regular file. All numeric fields are
// zero-padded octal ASCII; the buffer starts zeroed so unused fields (uname,
// gname, devmajor/minor, prefix) and terminating NULs come for free.
function header(path, size, mtime) {
  const buf = Buffer.alloc(BLOCK);
  buf.write(path, 0, 100, 'utf8'); // name
  buf.write('0000644', 100, 'ascii'); // mode
  buf.write('0000000', 108, 'ascii'); // uid
  buf.write('0000000', 116, 'ascii'); // gid
  buf.write(size.toString(8).padStart(11, '0'), 124, 'ascii'); // size (bytes)
  buf.write(Math.floor(mtime).toString(8).padStart(11, '0'), 136, 'ascii');
  // chksum is computed over the header with its own field set to 8 spaces,
  // then stored as six octal digits, NUL, space — the historical format every
  // tar implementation expects.
  buf.fill(0x20, 148, 156);
  buf.write('0', 156, 'ascii'); // typeflag: regular file
  buf.write('ustar', 257, 'ascii'); // magic (NUL-terminated via the zeroed buf)
  buf.write('00', 263, 'ascii'); // version
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += buf[i];
  buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return buf;
}

// files: [{ path, content }] with string content (UTF-8). mtime is seconds
// since epoch — the caller passes export time; the default 0 keeps unit tests
// byte-stable. Returns the complete archive as one Buffer.
export function tarball(files, { mtime = 0 } = {}) {
  const parts = [];
  for (const { path, content } of files) {
    if (Buffer.byteLength(path, 'utf8') > 100) {
      throw new Error(`tar path exceeds 100 bytes: ${path}`);
    }
    const data = Buffer.from(content, 'utf8');
    parts.push(header(path, data.length, mtime));
    parts.push(data);
    const overhang = data.length % BLOCK;
    if (overhang) parts.push(Buffer.alloc(BLOCK - overhang));
  }
  // End-of-archive: two zero blocks.
  parts.push(Buffer.alloc(2 * BLOCK));
  return Buffer.concat(parts);
}
