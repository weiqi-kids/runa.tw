// 首頁與產品頁共用的展示資料：產品（依價格排序）、「我適合哪一組」、社群帳號、活動折扣碼。
import { getEntry, getEntries } from 'astro:content';
import { all, listed, published } from './site';

export async function showcase() {
  const brands = new Map((await all('brands')).map((b) => [b.id, b.data.name]));
  const products = (await listed('products')).sort((a, b) => (a.data.price?.amount ?? 0) - (b.data.price?.amount ?? 0));
  // 首頁與產品頁的「我適合哪一組」固定用 KORENA 三組比較
  const cmp = (await all('comparisons')).find((c) => c.id === 'korena-5-vs-11-vs-17-piece-set');
  const pickIf = cmp ? await Promise.all(cmp.data.pickIf.map(async (p) => ({ ...p, entry: await getEntry(p.product) }))) : [];
  const cmpProducts = cmp ? await getEntries(cmp.data.products) : [];
  const needs = await all('needs');
  const guides = await all('guides');
  return { brands, products, cmp, cmpProducts, pickIf, needs, guides, published };
}

// 社群帳號。填了才會顯示成可點的按鈕，沒填的顯示「待設定」。
export const SOCIAL: { label: string; url: string | null }[] = [
  { label: 'Instagram', url: null },
  { label: 'YouTube', url: null },
  { label: 'Threads', url: null },
  { label: 'LINE 官方帳號', url: null },
];

// 活動折扣碼：官網頁面公開的碼，不是本站專屬碼
export const COUPON = { code: 'go1010', off: 1010, note: 'KORENA 1010 秋日奢養活動' };
