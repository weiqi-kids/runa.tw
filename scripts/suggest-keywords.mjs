#!/usr/bin/env node
// 讀者怎麼問：抓 Google 搜尋建議字（台灣、繁中），規劃系列與標題用。流程見 docs/選品SOP.md。
// 建議字只代表「有人這樣搜」，沒有搜尋量；量要等 GSC 有曝光再看（pnpm seo）。
//
//   pnpm keywords 皮秒雷射 淡斑精華          # 每個種子字 × 常見修飾詞
//   pnpm keywords 修修瓶 --plain             # 只查種子字本身
//
// 輸出同時寫到 data/seo-daily/keywords-YYYYMMDD.md（不進版控）。

import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const PLAIN = args.includes('--plain');
const seeds = args.filter((a) => !a.startsWith('--'));
if (!seeds.length) {
  console.error('用法：pnpm keywords <種子字> [<種子字>…] [--plain]');
  process.exit(1);
}

// 修飾詞：問法（怎麼、有用嗎）、比較購買（推薦、評價、比較、價格）、口碑來源（ptt、dcard）。
const MODS = PLAIN ? [''] : ['', '怎麼', '推薦', 'ptt', 'dcard', '有用嗎', '評價', '哪個好', '比較', '價格'];

async function suggest(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=zh-TW&gl=tw&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${q}`);
  return (await res.json())[1];
}

const lines = [];
for (const seed of seeds) {
  const found = new Set();
  for (const mod of MODS) {
    for (const s of await suggest(mod ? `${seed} ${mod}` : seed)) found.add(s);
    await new Promise((r) => setTimeout(r, 150));
  }
  lines.push(`## ${seed}（${found.size}）`, '', [...found].join('｜'), '');
}

const out = lines.join('\n');
console.log(out);
const dir = new URL('../data/seo-daily/', import.meta.url);
mkdirSync(dir, { recursive: true });
const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
writeFileSync(new URL(`keywords-${day}.md`, dir), out);
