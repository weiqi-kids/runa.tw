#!/usr/bin/env node
// 選品候選清單：iChannels 品牌條件 × 站上定位 × GSC 搜尋需求 × GA 閱讀興趣。
// 流程與判讀見 docs/選品SOP.md。這支只出「候選」，入選與否由人判斷（要實測、要寫得出缺點）。
//
//   pnpm picks                 # 用 data/private/ 最新一份品牌匯出，印出前 30 名與各分類前 5 名
//   pnpm picks --offline       # 不查 GSC／GA（沒有 gcloud 權限時）
//   pnpm picks --top 50
//
// 輸出同時寫到 data/private/picks-YYYYMMDD.md（不進版控：品牌佣金條件是會員限定資料）。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { googleToken, client, GSC_SITE, GA_PROPERTY, period } from './lib/google.mjs';

const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const TOP = Number(args[args.indexOf('--top') + 1]) || 30;
const DIR = new URL('../data/private/', import.meta.url);

// ── 站上定位：iChannels 分類 → 權重（0 = 不做）。這是編輯判斷，不是數據；要調就改這裡並在 SOP 記一筆。
//   金融理財：多是借貸名單（CPL），與「嚴選」的信任定位衝突
//   購物商城：平台不是產品，沒辦法寫成一頁產品知識頁
const FIT = {
  美妝保養: 1.0, 保健醫療: 0.9, 家居生活: 0.9, '3C家電': 0.9, 媽咪寶貝: 0.8,
  旅遊訂房: 0.6, 美食特產: 0.6, 服飾精品: 0.5, 寵物水族: 0.5, 教育學習: 0.4,
  書籍雜誌: 0.3, 網路服務: 0.3, 線上遊戲: 0.1, 購物商城: 0, 金融理財: 0, 其他類別: 0,
};

// ── 需求訊號：搜尋字詞 → 分類。GSC 有字詞之後，用這張表把曝光歸到分類。
const QUERY_HINTS = {
  美妝保養: ['保養', '精華', '面膜', '乳液', '化妝水', '抗老', '美白', '保濕', '防曬', '洗面', '彩妝', '香水'],
  保健醫療: ['保健', '益生菌', '維他命', '魚油', '膠原', '蛋白', '衛生棉', '健康'],
  家居生活: ['收納', '清潔', '拖把', '寢具', '床墊', '枕頭', '除甲醛', '防蚊', '鍋'],
  '3C家電': ['耳機', '充電', '手機', '筆電', '吸塵器', '家電', '行動電源', '線材', '散熱'],
  媽咪寶貝: ['寶寶', '嬰兒', '育兒', '兒童', '親子', '孕', '童裝'],
  旅遊訂房: ['esim', 'wifi', '旅遊', '訂房', '飯店', '機票', '租車'],
  美食特產: ['零食', '水餃', '茶', '伴手禮', '肉乾', '比薩', '烘焙'],
  服飾精品: ['內衣', '衣服', '鞋', '包', '眼鏡', '飾品', '襪'],
  寵物水族: ['狗', '貓', '寵物'],
  教育學習: ['英文', '課程', '學習', '線上課'],
};
// 站上內容頁 → 分類（GA 看讀者在讀哪一類）
const PAGE_HINTS = { '/categories/anti-aging-skincare-sets/': '美妝保養', '/products/korena-': '美妝保養', '/comparisons/korena-': '美妝保養', '/guides/how-to-read-skincare-bundle/': '美妝保養', '/needs/first-try-skincare/': '美妝保養' };

// ── 讀最新的品牌匯出
const files = readdirSync(DIR).filter((f) => /^ichannels-brands-\d{8}\.psv$/.test(f)).sort();
if (!files.length) { console.error('data/private/ 沒有品牌匯出。照 docs/選品SOP.md「步驟 1」匯出。'); process.exit(1); }
const file = files.at(-1);
const [head, ...lines] = readFileSync(new URL(file, DIR), 'utf-8').trim().split('\n');
const cols = head.split('|');
const brands = lines.map((l) => Object.fromEntries(l.split('|').map((v, i) => [cols[i], v])));

// 已經在站上的品牌（brands/*.md 有 merchantId）不重複推薦
const onSite = new Set(readdirSync(new URL('../src/content/brands/', import.meta.url))
  .map((f) => readFileSync(new URL(`../src/content/brands/${f}`, import.meta.url), 'utf-8').match(/merchantId:\s*(\d+)/)?.[1])
  .filter(Boolean));

// ── 解析佣金條件（只取數字，文字原樣保留在輸出裡給人看）
const maxOf = (re, s) => Math.max(0, ...[...s.matchAll(re)].map((m) => Number(m[1])));
function parse(b) {
  const cps = maxOf(/CPS\s*([\d.]+)%/g, b.commission);
  const fixed = maxOf(/(?:CPL|CPA|CPI|CPS)\s*([\d.]+)元/g, b.commission);
  const c = b.cookie;
  const cookie = /min/.test(c) ? 0 : /一天/.test(c) ? 1 : Number(c.match(/\d+/)?.[0] ?? NaN);
  const epc = Number(b.epc30.replace(/[,元]/g, '')) || 0;
  return { cps, fixed, cookie: Number.isNaN(cookie) ? null : cookie, epc };
}

// ── 需求訊號（可選）
const demand = Object.fromEntries(Object.keys(FIT).map((k) => [k, 0]));
const notes = [];
if (!OFFLINE) {
  try {
    const api = client(await googleToken());
    const { start, end } = period(28);
    const gsc = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
      { startDate: start, endDate: end, dimensions: ['query'], rowLimit: 1000 });
    let matched = 0;
    for (const r of gsc.rows ?? []) {
      const q = r.keys[0].toLowerCase();
      for (const [cat, words] of Object.entries(QUERY_HINTS)) if (words.some((w) => q.includes(w))) { demand[cat] += r.impressions; matched++; }
    }
    notes.push(`GSC ${start}~${end}：${(gsc.rows ?? []).length} 個查詢字詞，${matched} 次對應到分類`);
    const ga = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY}:runReport`, {
      dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], limit: 500,
    });
    if (ga.error) notes.push(`GA：${ga.error.message.slice(0, 80)}`);
    else {
      let views = 0;
      for (const r of ga.rows ?? []) {
        const p = r.dimensionValues[0].value;
        const hit = Object.entries(PAGE_HINTS).find(([prefix]) => p.startsWith(prefix));
        if (hit) { demand[hit[1]] += Number(r.metricValues[0].value); views += Number(r.metricValues[0].value); }
      }
      notes.push(`GA ${start}~${end}：內容頁瀏覽 ${views} 次對應到分類`);
    }
  } catch (e) { notes.push(`需求訊號略過：${e.message}`); }
} else notes.push('--offline：沒有查 GSC／GA');

const maxDemand = Math.max(...Object.values(demand));
// 需求加成：沒有數據時是 1（不影響），有數據時最熱門的分類 ×1.5
const boost = (cat) => (maxDemand > 0 ? 1 + 0.5 * (demand[cat] / maxDemand) : 1);
const maxEpc = Math.max(1, ...brands.map((b) => parse(b).epc));

// ── 評分：分類適配 ×（佣金 45%＋EPC 25%＋Cookie 20%＋免審核 10%）× 需求加成
const scored = brands.map((b) => {
  const m = parse(b);
  const cats = b.categories.split('/').filter(Boolean);
  const fitCat = cats.reduce((a, c) => ((FIT[c] ?? 0) > (FIT[a] ?? 0) ? c : a), cats[0]);
  const fit = FIT[fitCat] ?? 0;
  const pay = m.cps > 0 ? Math.min(m.cps / 20, 1) : Math.min(m.fixed / 500, 1);
  const epc = Math.log1p(m.epc) / Math.log1p(maxEpc);
  const cookie = m.cookie == null ? 0.3 : Math.min(m.cookie / 30, 1);
  const open = b.review === '不需審核' ? 1 : 0;
  const score = fit * (0.45 * pay + 0.25 * epc + 0.2 * cookie + 0.1 * open) * boost(fitCat);
  const flags = [
    b.status !== '可推廣，拿連結' && '要先申請',
    m.cookie != null && m.cookie <= 1 && 'Cookie≤1天',
    m.cps === 0 && m.fixed > 0 && '固定金額（名單型）',
    /加碼/.test(b.commission) && '加碼中',
    // 編號小、EPC 為 0 的多是早期 Mymall 店家，先確認官網還在營運、商品還在賣
    Number(b.id) < 1100 && m.epc === 0 && '舊品牌先確認營運',
    /沙龍|診所|課程|學院|美語|翻譯|寬頻|VPN|訂閱/.test(b.name + b.commission) && '服務型',
  ].filter(Boolean);
  return { ...b, ...m, fitCat, fit, score, flags, onSite: onSite.has(b.id) };
}).filter((b) => b.fit > 0 && !b.onSite).sort((a, b) => b.score - a.score);

// ── 輸出
const today = new Date().toISOString().slice(0, 10);
const row = (b, i) => `| ${i + 1} | ${b.name} | ${b.fitCat} | ${b.cps ? `${b.cps}%` : `${b.fixed}元`} | ${b.cookie ?? '—'} | ${b.epc || '—'} | ${b.score.toFixed(3)} | ${b.flags.join('、')} |`;
const TH = '| # | 品牌 | 分類 | 最高佣金 | Cookie天 | 30天EPC | 分數 | 注意 |\n|---|---|---|---|---|---|---|---|';
const out = [
  `# 選品候選 ${today}`,
  '',
  `品牌來源：${file}（${brands.length} 筆，排除站上已有 ${onSite.size} 個與分類權重 0 的品牌後剩 ${scored.length} 筆）`,
  ...notes.map((n) => `- ${n}`),
  '',
  maxDemand > 0
    ? '需求加成：' + Object.entries(demand).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join('、')
    : '需求加成：尚無數據（全部 ×1，排名只反映品牌條件與站上定位）',
  '',
  `## 總排名前 ${TOP}`,
  '',
  TH,
  ...scored.slice(0, TOP).map(row),
  '',
  '## 各分類前 5',
  ...Object.keys(FIT).filter((c) => FIT[c] > 0).flatMap((c) => {
    const list = scored.filter((b) => b.fitCat === c).slice(0, 5);
    return list.length ? ['', `### ${c}（權重 ${FIT[c]}）`, '', TH, ...list.map(row)] : [];
  }),
  '',
].join('\n');

writeFileSync(new URL(`picks-${today.replaceAll('-', '')}.md`, DIR), out);
console.log(out);
console.log(`已寫入 data/private/picks-${today.replaceAll('-', '')}.md`);
