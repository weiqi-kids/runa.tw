#!/usr/bin/env node
// 線上現況：GSC 收錄與曝光、GA4 流量。文件裡不寫現況數字，要看就跑這支，輸出即事實。
//
//   pnpm seo              # 全部
//   pnpm seo index        # sitemap＋逐頁抽查收錄
//   pnpm seo traffic      # GSC 曝光點擊＋GA4 流量來源
//   pnpm seo submit       # 提交（或重新提交）sitemap
//   pnpm seo clicks       # 各產品購買按鈕點擊（GA 事件 buy_click）
//
// 存取方式：不下載金鑰。以 gcloud 使用者 token 模擬服務帳號 runa-index@runa-tw（GCP 專案 runa-tw），
// token 不會印出來。先決條件：
//   1. gcloud auth login 過（帳號對服務帳號有 Service Account Token Creator）
//   2. GSC「設定 → 使用者和權限」把服務帳號加為「完整」使用者
//   3. GA4 資源「管理 → 資源存取管理」把服務帳號加為「編輯者」（Admin API 改設定要用到）

import { googleToken, SA, GSC_SITE as SITE, ORIGIN, GA_PROPERTY, period } from './lib/google.mjs';

const only = process.argv[2] ?? 'all';
const want = (s) => only === 'all' || only === s;
const { start, end } = period(28);

let token;
try { token = await googleToken(); } catch (e) { console.error(e.message); process.exit(1); }

const call = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : {} };
};
const api = async (url, body) => (await call(body ? 'POST' : 'GET', url, body)).json;

// URL 檢查 API 偶發回 500，重試就好；不重試會印出看起來像站台問題的假警報
const inspect = async (u) => {
  for (let i = 0; i < 3; i++) {
    const d = await api('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      inspectionUrl: u, siteUrl: SITE, languageCode: 'zh-TW',
    });
    if (!d.error || d.error.code < 500) return d;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return { error: { code: 500, message: '重試 3 次仍失敗' } };
};

const enc = encodeURIComponent(SITE);
const pad = (s, n) => String(s).padEnd(n);
const num = (v) => Number(v ?? 0).toLocaleString('en-US');
const SITEMAP = `${ORIGIN}/sitemap-index.xml`;

// 先確認服務帳號看得到這個 GSC 資源，看不到就直接講清楚要做什麼，不要往下噴一堆 403
const sites = await api('https://searchconsole.googleapis.com/webmasters/v3/sites');
const mine = (sites.siteEntry ?? []).find((s) => s.siteUrl === SITE);
if (!mine) {
  console.error(`服務帳號看不到 ${SITE}。到 GSC「設定 → 使用者和權限」把 ${SA} 加為「完整」使用者。`);
  process.exit(1);
}
console.log(`GSC ${SITE}　權限 ${mine.permissionLevel}`);
console.log(`期間 ${start} ~ ${end}（不含今天：GSC 有 2–3 天延遲）`);

if (only === 'submit') {
  const r = await call('PUT', `https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/sitemaps/${encodeURIComponent(SITEMAP)}`);
  console.log(r.status === 200 || r.status === 204 ? `已提交 ${SITEMAP}` : `提交失敗 ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  process.exit(r.status < 300 ? 0 : 1);
}

// 每個頁型各抽一個；草稿頁（產品、比較）預期是 noindex，不是錯誤
const SAMPLE = ['/', '/picks/', '/categories/', '/needs/', '/comparisons/', '/about/method/', '/products/korena-caviar-5-piece-set/'];

if (want('index')) {
  console.log('\n===== sitemap =====');
  const sm = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/sitemaps`);
  if (!sm.sitemap?.length) console.log(`  還沒提交。跑 \`pnpm seo submit\`。`);
  for (const s of sm.sitemap ?? []) {
    const c = (s.contents ?? [{}])[0];
    console.log(`  ${s.path}`);
    console.log(`    送出 ${(s.lastSubmitted ?? '').slice(0, 16)}　下載 ${(s.lastDownloaded ?? '').slice(0, 16) || '尚未'}`);
    console.log(`    errors ${s.errors ?? 0}　warnings ${s.warnings ?? 0}　submitted ${num(c.submitted)}`);
  }

  console.log('\n===== 逐頁抽查（收錄進度以這裡為準）=====');
  for (const p of SAMPLE) {
    const d = await inspect(ORIGIN + p);
    if (d.error) { console.log(`  ${pad(p, 42)} ERROR ${d.error.code} ${(d.error.message ?? '').slice(0, 60)}`); continue; }
    const i = d.inspectionResult?.indexStatusResult ?? {};
    const notes = [];
    if (i.robotsTxtState && !['ALLOWED', 'ROBOTS_TXT_STATE_UNSPECIFIED'].includes(i.robotsTxtState)) notes.push(`✗robots=${i.robotsTxtState}`);
    if (i.pageFetchState && !['SUCCESSFUL', 'PAGE_FETCH_STATE_UNSPECIFIED'].includes(i.pageFetchState)) notes.push(`✗fetch=${i.pageFetchState}`);
    if (i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical) notes.push(`✗canonical→${i.googleCanonical}`);
    console.log(`  ${pad(p, 42)} ${pad(i.verdict ?? '?', 8)} ${i.coverageState ?? '?'}　檢索 ${(i.lastCrawlTime ?? '').slice(0, 10) || '—'} ${notes.join(' ')}`);
  }
}

if (want('traffic')) {
  console.log('\n===== GSC 曝光與點擊 =====');
  const q = (dims, rowLimit) =>
    api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
      { startDate: start, endDate: end, dimensions: dims, rowLimit });
  const byDate = await q(['date'], 100);
  if (!byDate.rows?.length) {
    console.log('  期間內沒有任何曝光（新站正常）');
  } else {
    const imp = byDate.rows.reduce((s, r) => s + r.impressions, 0);
    const clk = byDate.rows.reduce((s, r) => s + r.clicks, 0);
    console.log(`  有曝光的天數 ${byDate.rows.length}　總曝光 ${num(imp)}　總點擊 ${num(clk)}`);
    for (const r of byDate.rows.slice(-7)) console.log(`    ${r.keys[0]}  曝光 ${pad(num(r.impressions), 6)} 點擊 ${num(r.clicks)}`);
    console.log('\n  前 10 個查詢：');
    const byQuery = await q(['query'], 10);
    for (const r of byQuery.rows ?? []) {
      console.log(`    ${pad(r.keys[0].slice(0, 28), 30)} 曝光 ${pad(num(r.impressions), 6)} 點擊 ${pad(num(r.clicks), 4)} 排名 ${r.position.toFixed(1)}`);
    }
  }

  console.log('\n===== GA4 流量來源 =====');
  if (!GA_PROPERTY) {
    console.log('  還沒設定 GA4 資源 ID（RUNA_GA_PROPERTY），略過');
  } else {
    const ga = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY}:runReport`, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      limit: 20,
    });
    if (ga.error) {
      console.log(`  ERROR ${ga.error.code} ${ga.error.message?.slice(0, 120)}`);
      // 2026-09-29 新建資源當天遇過；當時即時報表有資料（權限沒問題）。推測是報表資料尚未處理完成，未查證。
      if (/shard id/i.test(ga.error.message ?? '')) console.log('  （新資源常見：一般報表資料尚未處理完成，隔天再跑；未查證）');
    }
    else if (!ga.rows?.length) console.log('  期間內沒有流量');
    else for (const r of ga.rows) {
      const src = r.dimensionValues[0].value;
      console.log(`  ${pad(src, 28)} session ${pad(r.metricValues[0].value, 5)} 使用者 ${r.metricValues[1].value}${src === 'google / organic' ? '  ← 自然搜尋' : ''}`);
    }
  }
}

if (want('clicks')) {
  console.log('\n===== 購買按鈕點擊（GA 事件 buy_click）=====');
  const r = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY}:runReport`, {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'customEvent:product_id' }, { name: 'customEvent:placement' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'buy_click' } } },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 50,
  });
  if (r.error && /customEvent/.test(r.error.message ?? '')) console.log('  自訂維度（product_id 等）還沒生效：2026-09-29 建立，GA 通常要一段時間才能查詢，隔天再跑');
  else if (r.error) console.log(`  ERROR ${r.error.code} ${r.error.message?.slice(0, 120)}`);
  else if (!r.rows?.length) console.log('  期間內沒有點擊（自訂維度 2026-09-29 才建立，之前的點擊不會出現）');
  else for (const x of r.rows) console.log(`  ${pad(x.dimensionValues[0].value, 40)} ${pad(x.dimensionValues[1].value, 8)} ${x.metricValues[0].value} 次`);
}

console.log('');
