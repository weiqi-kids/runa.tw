// build 之後檢查 dist/ 內所有站內連結都打得開。有壞連結就以非 0 結束。
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p); else if (p.endsWith('.html')) yield p;
  }
}
const exists = async (p) => stat(p).then(() => true, () => false);
const bad = [];
let n = 0;
for await (const f of walk(DIST)) {
  const html = await readFile(f, 'utf-8');
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
    n++;
    const target = path.join(DIST, decodeURI(href));
    const ok = href.endsWith('/') ? await exists(path.join(target, 'index.html')) : await exists(target);
    if (!ok) bad.push(`${path.relative(DIST, f)} → ${href}`);
  }
}
console.log(`檢查 ${n} 個站內連結，壞掉 ${bad.length} 個`);
if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
