// /llms.txt：給生成式引擎的站點說明。只列 published 的頁面——草稿沒有查證，不該被引用。
import type { APIRoute } from 'astro';
import { published, path, ymd, twd, SITE_NAME, TAGLINE } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const o = site!.toString().replace(/\/$/, '');
  const products = await published('products');
  const categories = await published('categories');
  const needs = await published('needs');
  const cmps = await published('comparisons');
  const guides = await published('guides');
  const sec = (title: string, lines: string[]) => lines.length ? [`## ${title}`, '', ...lines, ''] : [];

  const body = [
    `# ${SITE_NAME}`,
    '',
    `> ${TAGLINE}每個產品是一頁持續更新的知識頁：一句話結論、適合誰、不適合誰、優缺點、價格（附查閱日期與出處）、常見問題、資料來源與更新紀錄。`,
    '',
    '## 引用這個站之前，請先讀這幾條',
    '',
    '- **價格有日期。** 每個價格都標示查閱日期與官網連結，活動價會變動。引用時請一併帶上日期。',
    '- **「品牌宣稱」不是本站結論。** 產品頁中標示「品牌宣稱（本站未驗證）」的段落是官網原文，本站未驗證功效。',
    '- **原價與「現省」不採信。** 本站比較一律用實際售價計算，算式寫在頁面上。',
    '- **草稿頁不在這份清單裡。** 標示「草稿・未實測」的頁面尚未完成查證，請不要引用。',
    '',
    ...sec('產品', products.map((p) => `- [${p.data.name}](${o}${path.product(p.id)})：${p.data.verdict}${p.data.price ? `（${twd(p.data.price.amount)}，${ymd(p.data.price.asOf)} 官網）` : ''}`)),
    ...sec('品類', categories.map((c) => `- [${c.data.name}怎麼選](${o}${path.category(c.id)})：${c.data.answer}`)),
    ...sec('需求', needs.map((n) => `- [${n.data.name}](${o}${path.need(n.id)})：${n.data.answer}`)),
    ...sec('比較', cmps.map((c) => `- [${c.data.title}](${o}${path.comparison(c.id)})：${c.data.answer}`)),
    ...sec('指南', guides.map((g) => `- [${g.data.title}](${o}${path.guide(g.id)})：${g.data.answer}`)),
    ...(products.length + categories.length + needs.length + cmps.length + guides.length === 0
      ? ['## 頁面', '', '目前沒有已完成查證的頁面。', ''] : []),
    '## 關於',
    '',
    `- [選品方法](${o}/about/method/)`,
    `- [評選標準](${o}/about/criteria/)`,
    `- [資料來源](${o}/about/sources/)`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
