// 證據鏈：讀者與 AI 看到的每個事實，都要追得到是哪一筆資料來源。規則見 docs/選品SOP.md「證據鏈」。
//   - published 的指南、比較、產品至少一筆 sources；每筆要有 publisher、https 網址、查閱日期不在未來、網址不重複
//   - 內文的事實句（含數字，或寫「醫院／衛福部／研究／官網……說」）要標〔n〕，n 對應頁尾第 n 筆來源
//     表格：表格本身任一列、或緊接在表格前後的說明句有〔n〕即可
//     清單：每項自己標，或清單前的引言句（以「：」結尾）有〔n〕
//     明講查不到的句子（「沒有查到」「未查證」）本身就是交代，不用標；
//     「月奈怎麼看」「月奈的筆記」是編輯觀點，不檢查；講月奈自己實驗的句子連到實驗筆記（/lab/、/products/）就是出處
//   - 指南的每一筆來源都要在內文被引用至少一次（不列沒用到的來源充數）
//   - answer、faq 是純文字摘要，不寫〔n〕（會原樣顯示）
// 這支只讀 src/content，不用先建置；建置後的 JSON-LD citation 由 dist.test.mjs 檢查。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { CITE } from '../src/lib/cite.mjs';
const SIGNAL = /\d|醫院|衛福部|食藥署|衛生局|研究|文獻|統合分析|回顧|官網|公告|衛教|醫師|藥師|法規|規定|核准|許可/;
const OPINION = /月奈怎麼看|月奈的筆記/;
// 台灣時間的今天（CI 跑在 UTC，凌晨會差一天）
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

async function entries(dir) {
  const base = path.resolve('src/content', dir);
  const out = [];
  for (const f of (await readdir(base)).filter((n) => n.endsWith('.md'))) {
    const raw = await readFile(path.join(base, f), 'utf-8');
    const [, fm, ...rest] = raw.split(/^---$/m);
    out.push({ id: `${dir}/${f}`, fm, body: rest.join('---'), published: /^status:\s*published\s*$/m.test(fm) });
  }
  return out;
}

// frontmatter 的 sources 區塊（頂層 `sources:` 底下的 `  - title:` 項目）
export function parseSources(fm) {
  const lines = fm.split('\n');
  const start = lines.findIndex((l) => /^sources:\s*$/.test(l));
  if (start < 0) return [];
  const items = [];
  for (const l of lines.slice(start + 1)) {
    if (/^\S/.test(l)) break;
    const m = l.match(/^ {2}- title:\s*(.*)$/);
    if (m) { items.push({ title: m[1] }); continue; }
    const kv = l.match(/^ {4}(url|publisher|accessedAt):\s*(.*)$/);
    if (kv && items.length) items.at(-1)[kv[1]] = kv[2].trim();
  }
  return items;
}

export const cites = (s) => [...s.matchAll(CITE)].flatMap((m) => m[1].split(/[,，、]\s*/).map(Number));
const hasCite = (s) => cites(s).length > 0;
// 判斷是不是事實句時，不看連結網址與引用標號本身
const plain = (s) => s.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').replace(/\]\([^)]*\)/g, ']').replace(CITE, '');

// 找出內文裡沒有標來源的事實句
export function uncited(body) {
  const lines = body.split('\n');
  const bad = [];
  let opinion = false;
  const prevText = (i) => { for (let j = i - 1; j >= 0; j--) if (lines[j].trim()) return lines[j]; return ''; };
  const nextText = (i) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j]; return ''; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,6}\s/.test(l)) { opinion = OPINION.test(l); continue; }
    if (opinion || !l.trim()) continue;
    if (/月奈/.test(l) && /\]\(\/(?:lab|products)\//.test(l)) continue;
    if (/沒有查到|未查證|查不到/.test(l)) continue;
    if (l.startsWith('|')) {
      // 整張表一起看
      let j = i;
      while (j < lines.length && lines[j].startsWith('|')) j++;
      const rows = lines.slice(i, j);
      const covered = rows.some(hasCite) || hasCite(prevText(i)) || hasCite(nextText(j - 1));
      if (!covered) rows.slice(2).filter((r) => SIGNAL.test(plain(r))).forEach((r) => bad.push(r));
      i = j - 1;
      continue;
    }
    if (/^\s*(?:[-*]|\d+\.)\s/.test(l)) {
      if (hasCite(l) || !SIGNAL.test(plain(l))) continue;
      // 往上找清單前的引言句
      let j = i - 1;
      while (j >= 0 && (/^\s*(?:[-*]|\d+\.)\s/.test(lines[j]) || !lines[j].trim())) j--;
      const lead = j >= 0 ? lines[j] : '';
      if (/[：:]\s*(?:〔[^〕]*〕)?\s*$/.test(lead) && hasCite(lead)) continue;
      bad.push(l);
      continue;
    }
    if (SIGNAL.test(plain(l)) && !hasCite(l)) bad.push(l);
  }
  return bad;
}

const DIRS = { guides: true, comparisons: false, products: false }; // true：每筆來源都要被內文引用

for (const [dir, mustUseAll] of Object.entries(DIRS)) {
  test(`${dir}：published 有資料來源，來源欄位完整`, async () => {
    for (const e of (await entries(dir)).filter((x) => x.published)) {
      const src = parseSources(e.fm);
      assert.ok(src.length > 0, `${e.id} 沒有 sources`);
      const urls = new Set();
      src.forEach((s, i) => {
        const at = `${e.id} sources 第 ${i + 1} 筆`;
        assert.ok(s.publisher, `${at} 缺 publisher`);
        assert.match(s.url ?? '', /^https:\/\//, `${at} 網址要是 https`);
        assert.ok(!urls.has(s.url), `${at} 網址重複`);
        urls.add(s.url);
        assert.match(s.accessedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, `${at} 缺 accessedAt`);
        assert.ok(s.accessedAt <= today, `${at} accessedAt 在未來`);
      });
    }
  });

  test(`${dir}：內文的事實句都標了〔n〕，n 對得到來源`, async () => {
    // 一次列出所有頁面的問題，不要修一個跑一次
    const problems = [];
    for (const e of (await entries(dir)).filter((x) => x.published)) {
      const n = parseSources(e.fm).length;
      for (const k of cites(e.body)) if (k < 1 || k > n) problems.push(`${e.id} 引用〔${k}〕，但只有 ${n} 筆來源`);
      const bad = uncited(e.body);
      if (bad.length) problems.push(`${e.id} 有 ${bad.length} 句事實沒標來源：\n  ${bad.join('\n  ')}`);
      if (CITE.test(e.fm)) problems.push(`${e.id} 的 answer／faq 不要寫〔n〕`);
      CITE.lastIndex = 0;
      if (mustUseAll) {
        const used = new Set(cites(e.body));
        const unused = [...Array(n).keys()].map((i) => i + 1).filter((k) => !used.has(k));
        if (unused.length) problems.push(`${e.id} 這些來源沒有在內文被引用：${unused.join('、')}`);
      }
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });
}

test('證據鏈檢查本身：沒標的事實句會被抓到（反例）', () => {
  const body = [
    '## 段落', '臺大醫院說要防曬。', '月奈覺得很好用。',
    '| a | b |', '|---|---|', '| 價格 | 1,000 元 |', '', '表格之後的一般句子。',
    '醫院列的：〔1〕', '- 第一項 3 次',
    '- 衛福部說不行',
    '## 月奈怎麼看', '我擦了 8 週。',
  ].join('\n');
  assert.deepEqual(uncited(body), ['臺大醫院說要防曬。', '| 價格 | 1,000 元 |']);
});
