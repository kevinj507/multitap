// One-shot import: build the E1 (#223) large eval graph from jbranchaud/til
// (MIT). 15 categories x 12 notes + 15 hub nodes = 195 nodes, hub->note
// 'related' edges. Inserts fire the pg_notify trigger, so the running app's
// indexer embeds everything incrementally (serial, memory-safe).
const fs = require('fs');
const path = require('path');
const { Client } = require('/data/workspace/multitap/node_modules/pg');

const TIL = '/tmp/til';
const OWNER = '2df90d43-bf0d-46a0-b19e-7c31cab82420';
const CATS = ['rails', 'unix', 'postgres', 'ruby', 'vim', 'git', 'javascript',
  'react', 'elixir', 'mac', 'tmux', 'python', 'workflow', 'go', 'css'];
const PER_CAT = 12;

function yamlEscape(s) { return s.includes(':') || s.includes('"') || s.includes("'") ? JSON.stringify(s) : s; }

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres@localhost/proj_66613a2b0dde43d4122e3c55a97523d5' });
  await client.connect();

  const { rows: [g] } = await client.query(
    `INSERT INTO graphs (name, description, owner_user_id, last_modified_by)
     VALUES ('TIL — engineering notes (eval corpus, frozen)',
             'E1 (#223) eval corpus: 195 nodes imported from jbranchaud/til (MIT). Do not edit — qrels are frozen against these node ids.',
             $1, 'agent') RETURNING id`, [OWNER]);
  const gid = g.id;
  console.log('graph:', gid);

  let x = 0, y = 0, count = 0;
  const manifest = [];
  for (const cat of CATS) {
    const files = fs.readdirSync(path.join(TIL, cat)).filter((f) => f.endsWith('.md')).sort().slice(0, PER_CAT);
    // hub node
    const hubTitle = `${cat} — topic hub`;
    const hubBody = `Today I Learned notes about ${cat}. Each linked note documents one concrete technique or gotcha.`;
    const hubContent = `---\ntitle: ${yamlEscape(hubTitle)}\nstatus: done\nx: ${x}\ny: ${y}\n---\n${hubBody}`;
    const { rows: [hub] } = await client.query(
      `INSERT INTO tasks (graph_id, content, meta, last_modified_by)
       VALUES ($1, $2, $3, 'agent') RETURNING id`,
      [gid, hubContent, { title: hubTitle, status: 'done', x, y }]);
    manifest.push({ id: hub.id, cat, title: hubTitle, hub: true });

    let nx = x;
    for (const f of files) {
      nx += 260;
      const raw = fs.readFileSync(path.join(TIL, cat, f), 'utf8');
      const m = raw.match(/^#\s+(.+)\n/);
      let title = (m ? m[1] : f.replace(/\.md$/, '').replace(/-/g, ' ')).trim();
      if (title.length > 96) title = title.slice(0, 96);
      title = `${title} (${cat})`.slice(0, 100);
      const body = (m ? raw.slice(m[0].length) : raw).trim();
      const content = `---\ntitle: ${yamlEscape(title)}\nstatus: done\nx: ${nx}\ny: ${y}\n---\n${body}`;
      const { rows: [t] } = await client.query(
        `INSERT INTO tasks (graph_id, content, meta, last_modified_by)
         VALUES ($1, $2, $3, 'agent') RETURNING id`,
        [gid, content, { title, status: 'done', x: nx, y }]);
      await client.query(
        `INSERT INTO edges (graph_id, source_id, target_id, type, last_modified_by)
         VALUES ($1, $2, $3, 'related', 'agent')`, [gid, hub.id, t.id]);
      manifest.push({ id: t.id, cat, title, file: `${cat}/${f}` });
      count++;
    }
    y += 320; x = 0;
  }
  fs.writeFileSync('/tmp/til-manifest.json', JSON.stringify({ gid, nodes: manifest }, null, 1));
  console.log('notes:', count, 'hubs:', CATS.length, 'total:', count + CATS.length);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
