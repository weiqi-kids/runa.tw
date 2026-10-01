// 首頁搜尋框用的索引。站內搜尋照樣涵蓋草稿（站內使用者看得到草稿頁與橫幅），
// 對外的 sitemap 與 llms.txt 才只列 published。
import type { APIRoute } from 'astro';
import { all, listed, path } from '../lib/site';

export const GET: APIRoute = async () => {
  const brands = new Map((await all('brands')).map((b) => [b.id, b.data.name]));
  const rows = [
    ...(await listed('products')).map((p) => ({
      t: '產品', n: p.data.name, u: path.product(p.id),
      k: [brands.get(p.data.brand.id), p.data.verdict, ...p.data.fitFor, ...p.data.highlights].join(' '),
    })),
    ...(await all('categories')).map((c) => ({ t: '品類', n: c.data.name, u: path.category(c.id), k: `${c.data.group} ${c.data.answer}` })),
    ...(await all('needs')).map((n) => ({ t: '需求', n: n.data.name, u: path.need(n.id), k: n.data.problems.map((p) => p.problem).join(' ') })),
    ...(await listed('comparisons')).map((c) => ({ t: '比較', n: c.data.title, u: path.comparison(c.id), k: c.data.answer })),
    ...(await all('guides')).map((g) => ({ t: '指南', n: g.data.title, u: path.guide(g.id), k: g.data.answer })),
    ...[...brands].map(([id, name]) => ({ t: '品牌', n: name, u: path.brand(id), k: '' })),
  ];
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
