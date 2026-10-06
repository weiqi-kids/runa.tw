#!/usr/bin/env node
// 資料來源還活著嗎：逐一連線 src/content 裡 published 頁面的 sources 網址，列出打不開的。
// 不放進 pnpm verify：政府與醫院網站常擋海外或機器人連線（例如臺北榮總回 403），CI 上會誤報。
// 打不開的先用瀏覽器確認；真的下架就換來源或改寫句子，不要留著死連結。
//
//   pnpm sources
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const urls = new Map();
for (const dir of ['guides', 'comparisons', 'products', 'categories', 'needs']) {
  const base = path.resolve('src/content', dir);
  for (const f of (await readdir(base)).filter((n) => n.endsWith('.md'))) {
    const fm = (await readFile(path.join(base, f), 'utf-8')).split(/^---$/m)[1];
    if (!/^status:\s*published\s*$/m.test(fm)) continue;
    for (const m of fm.matchAll(/^ {4}url:\s*(\S+)/gm)) urls.set(m[1], [...(urls.get(m[1]) ?? []), `${dir}/${f}`]);
  }
}

const check = async (url) => {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch (e) { return e.name === 'TimeoutError' ? 'timeout' : 'error'; }
};

const bad = [];
const list = [...urls.keys()];
for (let i = 0; i < list.length; i += 8) {
  await Promise.all(list.slice(i, i + 8).map(async (u) => {
    const s = await check(u);
    if (typeof s !== 'number' || s >= 300) bad.push([s, u]);
  }));
}
console.log(`檢查 ${list.length} 個來源網址，打不開 ${bad.length} 個`);
for (const [s, u] of bad) console.log(`  ${s}  ${u}\n        ← ${urls.get(u).join('、')}`);
