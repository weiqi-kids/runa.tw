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

test('正式建置：published 頁可收錄、有 JSON-LD、在 sitemap 裡', { skip: !isProd }, async () => {
  const drafts = new Set(await draftPaths());
  const xml = await read('sitemap-0.xml');
  for (const dir of ['products', 'categories', 'needs', 'comparisons', 'guides']) {
    for (const f of (await readdir(path.resolve('src/content', dir))).filter((n) => n.endsWith('.md'))) {
      const p = `/${dir}/${f.replace(/\.md$/, '')}/`;
      if (drafts.has(p)) continue;
      const html = await read(`${p}index.html`);
      assert.doesNotMatch(html, /name="robots"/, `${p} 不該 noindex`);
      assert.match(html, /application\/ld\+json/, `${p} 缺 JSON-LD`);
      assert.ok(xml.includes(`${p}<`), `${p} 不在 sitemap`);
    }
  }
});

test('正式建置：列表頁不連到草稿產品（草稿只能用直接網址打開）', { skip: !isProd }, async () => {
  const drafts = (await draftPaths()).filter((p) => p.startsWith('/products/'));
  const pages = ['index.html', 'picks/index.html', 'products/index.html', 'categories/index.html', 'search-index.json'];
  for (const dir of ['categories', 'needs']) {
    for (const d of await readdir(path.join(DIST, dir), { withFileTypes: true })) if (d.isDirectory()) pages.push(`${dir}/${d.name}/index.html`);
  }
  for (const pg of pages) {
    const html = await read(pg);
    for (const p of drafts) assert.ok(!html.includes(`"${p}"`) && !html.includes(`href="${p}`), `${pg} 連到草稿 ${p}`);
  }
});

test('讀者看到的頁面沒有施工中字樣與「聯盟連結」標示', async () => {
  const words = ['整理中', '待設定', '尚無外部來源', '請勿引用', '聯盟連結', '這一區目前沒有'];
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : d.name.endsWith('.html') ? [p] : [];
  }))).flat();
  for (const f of await walk(DIST)) {
    const text = (await readFile(f, 'utf-8')).replace(/<script[\s\S]*?<\/script>/g, '');
    for (const w of words) assert.ok(!text.includes(w), `${path.relative(DIST, f)} 出現「${w}」`);
  }
});

test('實驗中的產品：頁面標「實驗中」、有實驗筆記、結構化資料不含評論', async () => {
  const base = path.resolve('src/content/products');
  const files = (await readdir(base)).filter((n) => n.endsWith('.md'));
  for (const f of files) {
    const fm = (await readFile(path.join(base, f), 'utf-8')).split(/^---$/m)[1];
    if (!/^stage:\s*testing\s*$/m.test(fm)) continue;
    const p = `products/${f.replace(/\.md$/, '')}/index.html`;
    const html = await read(p);
    assert.match(html, /實驗中/, p);
    assert.match(html, /id="lab"/, `${p} 缺實驗筆記`);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.ok(!JSON.parse(m[1]).review, `${p} 實驗中卻輸出 Review`);
    }
  }
});

test('正式建置：證據鏈輸出——引用標號都連得到來源、JSON-LD 帶 citation', { skip: !isProd }, async () => {
  const drafts = new Set(await draftPaths());
  for (const dir of ['guides', 'comparisons', 'products']) {
    for (const f of (await readdir(path.resolve('src/content', dir))).filter((n) => n.endsWith('.md'))) {
      const p = `/${dir}/${f.replace(/\.md$/, '')}/`;
      if (drafts.has(p)) continue;
      const html = await read(`${p}index.html`);
      assert.doesNotMatch(html, /〔\d/, `${p} 還有沒轉成連結的〔n〕`);
      const ids = new Set([...html.matchAll(/<li id="(src-\d+)"/g)].map((m) => m[1]));
      for (const m of html.matchAll(/<sup class="cite">[\s\S]*?<\/sup>/g)) {
        for (const a of m[0].matchAll(/href="#(src-\d+)"/g)) assert.ok(ids.has(a[1]), `${p} 引用 #${a[1]} 但頁尾沒有這筆來源`);
      }
      const citations = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .map((m) => JSON.parse(m[1])).flatMap((ld) => (Array.isArray(ld) ? ld : [ld])).find((ld) => ld.citation)?.citation ?? [];
      assert.equal(citations.length, ids.size, `${p} JSON-LD citation 有 ${citations.length} 筆，頁尾來源 ${ids.size} 筆`);
    }
  }
});

test('正式建置：每篇 published 指南都掛在某個主題底下（/guides/ 找得到）', { skip: !isProd }, async () => {
  const drafts = new Set(await draftPaths());
  const html = await read('guides/index.html');
  for (const f of (await readdir(path.resolve('src/content/guides'))).filter((n) => n.endsWith('.md'))) {
    const p = `/guides/${f.replace(/\.md$/, '')}/`;
    if (!drafts.has(p)) assert.ok(html.includes(`href="${p}"`), `${p} 沒有掛在 TOPICS（src/lib/site.ts）的任何主題，/guides/ 找不到`);
  }
});
