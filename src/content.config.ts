// 月奈創角的資料模型。網站的本體是這六種 Entity 與它們之間的關係，頁面只是呈現方式。
//
//   Brand ─┐
//          ▼
//   Category ◀── Product ──▶ Need
//                  │  ▲
//          media / sources（Evidence，掛在 Product 上，不另成孤島）
//                  │
//   Comparison ────┘  （引用 2+ 個 Product）
//   Guide ──────────▶ Category / Need / Product
//
// 規則（違反了建置會失敗，不是靠自律）：
//   - 欄位可空，但不可推論。來源沒寫的就不填，不要補「合理的預設值」。
//   - 每個 published 的 Product 至少一筆 sources，且要有 verdict / fitFor / notFitFor / cons。
//     沒有缺點的產品頁是廣告，不是選品。
//   - status: draft 的頁面 noindex、不進 sitemap／llms.txt／搜尋索引，頁首掛「未查證」橫幅。
import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const date = z.coerce.date();
const status = z.enum(['draft', 'published']).default('draft');

const source = z.object({
  title: z.string(),
  url: z.string().url(),
  publisher: z.string().optional(),
  // 何時看過這個來源。來源會改版，引用者需要知道我們看到的是哪個時間點的版本。
  accessedAt: date,
});

const faq = z.object({ q: z.string(), a: z.string() });

const change = z.object({ date, note: z.string() });

// 影音是 Product 的證據，不是獨立內容。YouTube / IG / Shorts / Reels 都掛在產品底下。
const media = z.object({
  platform: z.enum(['youtube', 'shorts', 'instagram', 'reels']),
  url: z.string().url(),
  title: z.string(),
  // VideoObject 的必填欄位。沒有就不輸出結構化資料，但頁面照樣顯示連結。
  uploadDate: date.optional(),
  thumbnail: z.string().url().optional(),
  // 這支影片在證明什麼：實測、開箱、長期使用……
  kind: z.enum(['review', 'unboxing', 'test', 'long-term', 'short']).default('review'),
});

// 嚴選標籤：首頁與 /picks/ 的分區。刻意做成標籤而不是獨立網址——
// 每區在內容還少的時候都只有一兩個產品，拆成獨立頁就是一堆薄頁。
export const PICKS = {
  latest: '最新嚴選',
  monthly: '本月嚴選',
  editor: '編輯嚴選',
  'black-tech': '黑科技',
  'hidden-gem': '冷門好物',
  watch: '值得關注',
} as const;
const pick = z.enum(Object.keys(PICKS) as [keyof typeof PICKS, ...(keyof typeof PICKS)[]]);

const brands = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/brands' }),
  schema: z.object({
    name: z.string(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    summary: z.string(),
    status,
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/categories' }),
  schema: z.object({
    name: z.string(),
    // 首頁與導覽的大分類（3C科技、居家生活…）。品類頁本身是細分類（降噪耳機）。
    group: z.string(),
    // 頁首的可引用摘要：一兩句直接回答「這類產品怎麼選」。
    answer: z.string(),
    whoNeedsIt: z.array(z.string()).default([]),
    howToChoose: z.array(z.object({ factor: z.string(), detail: z.string() })).default([]),
    faq: z.array(faq).default([]),
    sources: z.array(source).default([]),
    updatedAt: date,
    status,
  }),
});

const needs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/needs' }),
  schema: z.object({
    name: z.string(),
    // 情境 / 族群 / 送禮…，決定在 /needs/ 列表上的分組
    group: z.enum(['情境', '族群', '送禮']),
    answer: z.string(),
    // 需求 → 問題 → 解法。解法指向品類與產品，這是「需求頁」和一般文章的差別。
    problems: z.array(z.object({
      problem: z.string(),
      solution: z.string(),
      categories: z.array(reference('categories')).default([]),
      products: z.array(reference('products')).default([]),
    })).default([]),
    faq: z.array(faq).default([]),
    updatedAt: date,
    status,
  }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    brand: reference('brands'),
    category: reference('categories'),
    needs: z.array(reference('needs')).default([]),
    picks: z.array(pick).default([]),
    image: z.string().optional(),

    verdict: z.string(),                 // 一句話結論
    whySelected: z.string(),             // 為什麼入選
    fitFor: z.array(z.string()).min(1),
    notFitFor: z.array(z.string()).min(1),
    highlights: z.array(z.string()).default([]),
    pros: z.array(z.string()).min(1),
    cons: z.array(z.string()).min(1),
    specs: z.array(z.object({ label: z.string(), value: z.string(), source: z.string().url().optional() })).default([]),
    competitors: z.array(reference('products')).default([]),

    // 價格是會過期的事實：一定要帶日期與出處，否則不顯示數字。
    price: z.object({
      amount: z.number().int().positive(),
      currency: z.literal('TWD').default('TWD'),
      asOf: date,
      source: z.string().url(),
      note: z.string().optional(),
    }).optional(),
    // affiliate: true 的連結在頁面上會標「聯盟連結」並加 rel="sponsored"。
    buy: z.array(z.object({ label: z.string(), url: z.string().url(), affiliate: z.boolean().default(false) })).default([]),

    media: z.array(media).default([]),
    faq: z.array(faq).default([]),
    sources: z.array(source).default([]),

    publishedAt: date,
    updatedAt: date,
    changelog: z.array(change).default([]),
    status,
  }).superRefine((p, ctx) => {
    if (p.status === 'published' && p.sources.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: 'published 的產品至少要有一筆資料來源' });
    }
  }),
});

const comparisons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/comparisons' }),
  schema: z.object({
    title: z.string(),
    products: z.array(reference('products')).min(2).max(4),
    answer: z.string(),
    // 比較表：每列一個維度，values 與 products 同順序
    rows: z.array(z.object({
      label: z.string(),
      values: z.array(z.string()),
      winner: z.number().int().min(0).optional(),   // products 的索引；平手就不填
    })),
    // 「如果你是 A → 選 X」
    pickIf: z.array(z.object({ if: z.string(), product: reference('products') })).min(1),
    faq: z.array(faq).default([]),
    sources: z.array(source).default([]),
    updatedAt: date,
    status,
  }).refine((c) => c.rows.every((r) => r.values.length === c.products.length), {
    message: 'rows[].values 的數量要等於 products 的數量', path: ['rows'],
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['選品指南', '購買指南', '使用者痛點', '產品趨勢', '產業觀察']),
    answer: z.string(),
    categories: z.array(reference('categories')).default([]),
    needs: z.array(reference('needs')).default([]),
    products: z.array(reference('products')).default([]),
    faq: z.array(faq).default([]),
    sources: z.array(source).default([]),
    publishedAt: date,
    updatedAt: date,
    status,
  }),
});

export const collections = { brands, categories, needs, products, comparisons, guides };
