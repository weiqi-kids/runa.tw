import { getCollection, type CollectionEntry } from 'astro:content';

export const SITE_NAME = '月奈創角｜AI產品嚴選';
export const SITE_SHORT = '月奈創角';
export const TAGLINE = 'AI 幫你找到商品，月奈創角負責把商品研究清楚。';

// 本機與預覽建置：全站 noindex＋robots 全擋。GitHub Actions 部署到 runa.tw 時設 PUBLIC_SITE_STAGE=production。
export const IS_PRODUCTION = import.meta.env.PUBLIC_SITE_STAGE === 'production';

// GA4 與 Search Console 驗證碼放 GitHub repository variables（RUNA_GA_ID、RUNA_GSC_TOKEN），
// 不是 secrets——它們本來就會出現在每一頁的原始碼裡。沒設就不輸出。
// 用 `||` 不用 `??`：workflow 寫 `${{ vars.X }}` 時，變數沒設會得到空字串而不是 undefined。
export const GA_ID = process.env.RUNA_GA_ID || '';
export const GSC_TOKEN = process.env.RUNA_GSC_TOKEN || '';

export const NAV = [
  { href: '/picks/', label: 'AI產品嚴選' },
  { href: '/categories/', label: '找產品' },
  { href: '/needs/', label: '找需求' },
  { href: '/comparisons/', label: '產品比較' },
  { href: '/guides/', label: '深度選品' },
  { href: '/media/', label: '影音' },
  { href: '/about/', label: '關於' },
];

// 找產品的大分類。沒有品類的組別照樣列出，顯示「整理中」——讓人知道網站打算涵蓋什麼，
// 但不為空組別產生頁面（空頁就是薄頁）。
export const CATEGORY_GROUPS = ['3C科技', 'AI工具', '居家生活', '親子育兒', '美妝保養', '健康生活', '戶外旅行'];

export const isDraft = (e: { data: { status?: string } }) => e.data.status !== 'published';

type Name = 'brands' | 'categories' | 'needs' | 'products' | 'comparisons' | 'guides';
/** 每個頁面都會產生（含草稿，草稿會掛橫幅、noindex）；列表頁用 listed()，sitemap、llms.txt 只取 published。 */
export async function all<N extends Name>(name: N): Promise<CollectionEntry<N>[]> {
  return getCollection(name);
}
export async function published<N extends Name>(name: N): Promise<CollectionEntry<N>[]> {
  return (await getCollection(name)).filter((e) => !isDraft(e as never));
}
/** 列表頁用：正式站只列 published（草稿只能用直接網址打開，給站主審閱）；本機開發建置全部列出。 */
export async function listed<N extends Name>(name: N): Promise<CollectionEntry<N>[]> {
  return IS_PRODUCTION ? published(name) : all(name);
}

export const path = {
  product: (id: string) => `/products/${id}/`,
  category: (id: string) => `/categories/${id}/`,
  need: (id: string) => `/needs/${id}/`,
  comparison: (id: string) => `/comparisons/${id}/`,
  guide: (id: string) => `/guides/${id}/`,
  brand: (id: string) => `/brands/${id}/`,
};

export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const twd = (n: number) => `NT$${n.toLocaleString('en-US')}`;

export const MEDIA_LABEL = { youtube: 'YouTube', shorts: 'Shorts', instagram: 'Instagram', reels: 'Reels' } as const;
