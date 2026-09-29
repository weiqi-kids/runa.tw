// 建置輸出的收錄規則。要先 npm run build。
//   - 開發建置（沒有 PUBLIC_SITE_STAGE=production）：全站 noindex、robots 全擋
//   - 草稿頁：noindex、不輸出 JSON-LD、不進 sitemap、不進 llms.txt
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const read = (p) => readFile(path.join(DIST, p), 'utf-8');
const isProd = process.env.PUBLIC_SITE_STAGE === 'production';

async function draftPaths() {
  const out = [];
  for (const dir of ['products', 'categories', 'needs', 'comparisons', 'guides']) {
    const base = path.resolve('src/content', dir);
    for (const f of (await readdir(base)).filter((n) => n.endsWith('.md'))) {
      const fm = (await readFile(path.join(base, f), 'utf-8')).split(/^---$/m)[1];
      if (!/^status:\s*published\s*$/m.test(fm)) out.push(`/${dir}/${f.replace(/\.md$/, '')}/`);
    }
  }
  return out;
}

test('草稿頁 noindex、沒有 JSON-LD、有未實測橫幅', async () => {
  for (const p of await draftPaths()) {
    const html = await read(`${p}index.html`);
    assert.match(html, /<meta name="robots" content="noindex">/, p);
    assert.doesNotMatch(html, /application\/ld\+json/, p);
    assert.match(html, /草稿・未實測/, p);
  }
});

test('sitemap 不含草稿頁', async () => {
  const xml = await read('sitemap-0.xml');
  for (const p of await draftPaths()) assert.ok(!xml.includes(`${p}<`), `sitemap 含草稿 ${p}`);
});

test('llms.txt 不含草稿頁', async () => {
  const txt = await read('llms.txt');
  for (const p of await draftPaths()) assert.ok(!txt.includes(p), `llms.txt 含草稿 ${p}`);
});

test('開發建置全站 noindex、robots 全擋（反例測試）', { skip: isProd }, async () => {
  assert.match(await read('index.html'), /<meta name="robots" content="noindex">/);
  assert.match(await read('robots.txt'), /^Disallow: \/$/m);
});
