// 內文引用標號：〔1〕、〔1,3〕寫在句尾，建置完成後轉成連到頁尾「資料來源」第 n 筆（#src-n）的上標。
// 在 HTML 上轉而不是在 markdown 外掛裡轉：Astro 7 的預設 markdown 處理器（Sätteri）不跑 remark 外掛。
// 證據鏈的規則（哪些句子一定要標、每筆來源都要被引用）由 test/evidence.test.mjs 檢查，見 docs/選品SOP.md。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CITE = /〔(\d+(?:[,，、]\s*\d+)*)〕/g;

export const citeToHtml = (html) => html.replace(CITE, (_, nums) =>
  `<sup class="cite">[${nums.split(/[,，、]\s*/).map((n) => `<a href="#src-${n}">${n}</a>`).join(',')}]</sup>`);

export const citeIntegration = {
  name: 'cite-links',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const walk = async (d) => {
        for (const e of await readdir(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) await walk(p);
          else if (e.name.endsWith('.html')) {
            const html = await readFile(p, 'utf-8');
            if (CITE.test(html)) { CITE.lastIndex = 0; await writeFile(p, citeToHtml(html)); }
            CITE.lastIndex = 0;
          }
        }
      };
      await walk(dir.pathname);
    },
  },
};
