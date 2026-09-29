import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 正式網域。開發期部署在 *.workers.dev，但 canonical 一開始就指向正式網域，切換時不用改頁面。
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://runa.tw';

// sitemap 只列 published。草稿頁掛 noindex，列進 sitemap 等於自相矛盾。
// 直接讀 frontmatter 的 status 行，不在設定檔裡重跑一次 content 載入。
const COLLECTION_PATH = {
  products: 'products', categories: 'categories', needs: 'needs',
  comparisons: 'comparisons', guides: 'guides',
};
const drafts = new Set();
const lastmod = new Map();
const latest = (p, d) => { if (!lastmod.has(p) || lastmod.get(p) < d) lastmod.set(p, d); };
const publishedBrands = new Set();
for (const [dir, seg] of Object.entries(COLLECTION_PATH)) {
  const base = new URL(`./src/content/${dir}/`, import.meta.url);
  for (const f of readdirSync(base).filter((n) => n.endsWith('.md'))) {
    const fm = readFileSync(new URL(f, base), 'utf-8').split(/^---$/m)[1] ?? '';
    const p = `/${seg}/${f.replace(/\.md$/, '')}/`;
    if (!/^status:\s*published\s*$/m.test(fm)) drafts.add(p);
    // lastmod 取內容的 updatedAt，不取建置時間——每次 build 都刷新 lastmod，Google 會停止採信這個欄位
    const m = fm.match(/^updatedAt:\s*(\d{4}-\d{2}-\d{2})/m);
    if (m) lastmod.set(p, m[1]);
    if (dir === 'products' && !drafts.has(p)) {
      const brand = fm.match(/^brand:\s*(\S+)/m)?.[1];
      publishedBrands.add(brand);
      if (m) latest(`/brands/${brand}/`, m[1]);
    }
    // 列表頁（/products/ 等）與全站彙整頁的內容就是 published 條目的集合：取其中最新的 updatedAt
    if (m && !drafts.has(p)) { latest(`/${seg}/`, m[1]); latest('/', m[1]); }
  }
}
for (const p of ['/picks/', '/media/']) if (lastmod.has('/')) lastmod.set(p, lastmod.get('/'));
// 關於頁是手寫的靜態頁：取原始檔最後一次 commit 的日期（查不到就不給，不拿建置時間充數）
for (const f of readdirSync(new URL('./src/pages/about/', import.meta.url)).filter((n) => n.endsWith('.astro'))) {
  const p = f === 'index.astro' ? '/about/' : `/about/${f.replace(/\.astro$/, '')}/`;
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', `src/pages/about/${f}`], { encoding: 'utf-8' }).trim();
    if (d) lastmod.set(p, d);
  } catch { /* 沒有 git（例如 tarball 建置）就不給 lastmod */ }
}
// 品牌頁本身沒有查證內容：旗下沒有 published 產品時是 noindex（見 brands/[slug].astro），sitemap 也要排除
for (const f of readdirSync(new URL('./src/content/brands/', import.meta.url)).filter((n) => n.endsWith('.md'))) {
  const id = f.replace(/\.md$/, '');
  if (!publishedBrands.has(id)) drafts.add(`/brands/${id}/`);
}

// /llms-full.txt 的實作放在 src/lib（不是 src/pages）：靠 injectRoute 掛路由，
// 讓「給 LLM 的全文」跟其他站台資料組裝邏輯放在一起，不混進逐頁內容目錄。
const llmsFull = {
  name: 'llms-full-route',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/llms-full.txt', entrypoint: './src/lib/llms-full.ts', prerender: true });
    },
  },
};

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => !drafts.has(new URL(page).pathname),
      serialize: (item) => {
        const d = lastmod.get(new URL(item.url).pathname);
        return d ? { ...item, lastmod: d } : item;
      },
    }),
    llmsFull,
  ],
});
