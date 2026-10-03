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
//   - 每個 published 的 Product 至少一筆 sources。有結論（stage: concluded）的要有 fitFor / notFitFor / pros / cons；
//     沒有缺點的產品頁是廣告，不是選品。實驗中（testing）的改成要有 experiment 與至少一筆 log。
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

// 研究進度。網站是月奈的研究筆記：產品可以在「實驗中」就公開，邊用邊記，用完才下結論。
//   testing   實驗中：已公開開箱前的功課與使用紀錄，還沒有結論（不輸出 Review 結構化資料）
//   concluded 有結論：verdict／fitFor／notFitFor／pros／cons 都要齊
// 跟 status 是兩回事：status 管收錄（draft 不公開），stage 管研究做到哪。
export const STAGES = { testing: '實驗中', concluded: '有結論' } as const;

// 實驗筆記的一筆。kind：prep 開始前的功課、observe 使用中的觀察、result 結論。
export const LOG_KINDS = { prep: '開始前', observe: '使用中', result: '結論' } as const;
const logEntry = z.object({
  date,
  title: z.string(),
  note: z.string(),
  kind: z.enum(Object.keys(LOG_KINDS) as [keyof typeof LOG_KINDS, ...(keyof typeof LOG_KINDS)[]]).default('observe'),
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

// 缺點的性質（選填）。借自 agent.ecommerce-product-review 的負評三分類：
// 讀者最在意的是「沒效」和「出事」，跟「出貨慢」不能混在一起看。
// 來源沒講清楚是哪一種就不要填，寫成純字串即可。
export const CON_KINDS = {
  'no-effect': '沒解決問題',     // 用了沒感覺、效果不如宣稱
  'side-effect': '帶來新問題',   // 過敏、泛紅、爆痘、變乾
  purchase: '購買與服務',        // 出貨、包裝、客服、效期——跟產品本身無關
} as const;
const conKind = z.enum(Object.keys(CON_KINDS) as [keyof typeof CON_KINDS, ...(keyof typeof CON_KINDS)[]]);
// 寫法：`- 純文字` 或 `- { text: 純文字, kind: side-effect }`。建置後一律是 { text, kind? }。
const con = z.union([z.string(), z.object({ text: z.string(), kind: conKind.optional() })])
  .transform((c) => (typeof c === 'string' ? { text: c } : c));

const brands = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/brands' }),
  schema: z.object({
    name: z.string(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    summary: z.string(),
    // 聯盟行銷。有設定的品牌，產品頁的購買按鈕會自動換成推廣連結（rel="sponsored"，頁面不另外標示）。
    affiliate: z.object({
      network: z.literal('ichannels'),
      merchantId: z.number().int(),
      terms: z.string(),            // 佣金條件，給自己看的紀錄（例：CPS 17.5%、Cookie 30 天）
      checkedAt: date,
    }).optional(),
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
    // 縮圖列的其他圖片（不含 image）。沒有就不顯示縮圖列。
    gallery: z.array(z.string()).default([]),

    stage: z.enum(Object.keys(STAGES) as [keyof typeof STAGES, ...(keyof typeof STAGES)[]]).default('concluded'),
    // 實驗設定：想驗證什麼、怎麼觀察。startedAt 是第一天開始用的日期，還沒開始用就不填。
    experiment: z.object({
      question: z.string(),
      watch: z.array(z.string()).min(1),
      startedAt: date.optional(),
    }).optional(),
    log: z.array(logEntry).default([]),

    verdict: z.string(),                 // 一句話結論；實驗中是一句話現況
    whySelected: z.string(),             // 為什麼入選；實驗中是為什麼想研究它
    // 以下五項在 concluded 至少各一筆（superRefine 擋著）；實驗中可以先空著，用到哪寫到哪
    fitFor: z.array(z.string()).default([]),
    notFitFor: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    pros: z.array(z.string()).default([]),
    cons: z.array(con).default([]),
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
    // 填品牌官網的原始網址。品牌有設 affiliate 時，頁面會自動轉成推廣連結（src/lib/affiliate.ts）。
    buy: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),

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
    if (p.stage === 'concluded') {
      for (const k of ['fitFor', 'notFitFor', 'pros', 'cons'] as const) {
        if (p[k].length === 0) ctx.addIssue({ code: 'custom', path: [k], message: `有結論的產品 ${k} 至少一筆` });
      }
    } else {
      if (!p.experiment) ctx.addIssue({ code: 'custom', path: ['experiment'], message: '實驗中的產品要寫 experiment（想驗證什麼、觀察什麼）' });
      if (p.log.length === 0) ctx.addIssue({ code: 'custom', path: ['log'], message: '實驗中的產品至少要有一筆實驗筆記' });
    }
  }),
});

const comparisons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/comparisons' }),
  schema: z.object({
    title: z.string(),
    // 站上的產品（有自己的產品頁）
    products: z.array(reference('products')).default([]),
    // 站外產品：只在比較表裡出現，不建產品頁、不放購買連結。url 是查證用的官方資料來源。
    externals: z.array(z.object({ id: z.string(), name: z.string(), brand: z.string(), url: z.string().url() })).default([]),
    answer: z.string(),
    // 比較表：每列一個維度，values 依序對應 products 再接 externals
    rows: z.array(z.object({
      label: z.string(),
      values: z.array(z.string()),
      winner: z.number().int().min(0).optional(),   // 欄位索引；平手就不填
    })),
    // 「如果你是 A → 選 X」：product 指站上產品，external 指 externals[].id
    pickIf: z.array(z.object({ if: z.string(), product: reference('products').optional(), external: z.string().optional() })
      .refine((p) => !!p.product !== !!p.external, { message: 'pickIf 要嘛填 product，要嘛填 external' })).min(1),
    faq: z.array(faq).default([]),
    sources: z.array(source).default([]),
    updatedAt: date,
    status,
  }).refine((c) => c.products.length + c.externals.length >= 2 && c.products.length + c.externals.length <= 6, {
    message: '比較對象（products＋externals）要 2～6 個', path: ['products'],
  }).refine((c) => c.rows.every((r) => r.values.length === c.products.length + c.externals.length), {
    message: 'rows[].values 的數量要等於 products＋externals 的數量', path: ['rows'],
  }).refine((c) => c.pickIf.every((p) => !p.external || c.externals.some((e) => e.id === p.external)), {
    message: 'pickIf.external 要對應 externals[].id', path: ['pickIf'],
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
