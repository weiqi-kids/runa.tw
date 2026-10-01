#!/usr/bin/env node
// iChannels Web API：訂單與獎金、已加入推廣的品牌。文件摘要在 docs/ichannels-api.md。
//
//   pnpm orders              # 近 30 天訂單（依訂單成立時間），按品牌與獎金狀態彙總
//   pnpm orders --days 90
//   pnpm orders brands       # 已加入推廣的品牌與佣金條件（只列加入過的，不是全部 248 個）
//
// 金鑰與推廣代碼放在 .env（ICHANNELS_KEY、ICHANNELS_MEMBER_CODE），不進版控。
// API 只有 http：https 連不上（2026-10-01 實測）。金鑰在查詢字串裡，輸出一律遮掉。

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* 沒有 .env 就用環境變數 */ }
const KEY = process.env.ICHANNELS_KEY;
const MEMBER = process.env.ICHANNELS_MEMBER_CODE;
if (!KEY || !MEMBER) {
  console.error('缺 ICHANNELS_KEY 或 ICHANNELS_MEMBER_CODE。放進專案根目錄的 .env。');
  process.exit(1);
}

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'orders';
const DAYS = Number(args[args.indexOf('--days') + 1]) || 30;
const mask = (s) => String(s).split(KEY).join('[金鑰]');

async function call(path, params) {
  const q = new URLSearchParams({ key: KEY, member_code: MEMBER, ...params });
  const r = await fetch(`http://api.ichannels.com.tw/sitemember/${path}?${q}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error(mask(`回應不是 JSON（HTTP ${r.status}）：${text.slice(0, 120)}`)); }
}

// 分頁取完；每頁最多 1000 筆（訂單 API 的上限）
async function all(path, params, pageSize) {
  const rows = [];
  for (let page = 1; page < 100; page++) {
    const d = await call(path, { ...params, page: String(page), ...(pageSize ? { page_size: String(pageSize) } : {}) });
    if (d.response_status !== 1) return { rows, note: d.error_question ?? JSON.stringify(d).slice(0, 120) };
    rows.push(...(d.data ?? []));
    if (rows.length >= Number(d.total ?? 0) || !(d.data ?? []).length) break;
  }
  return { rows };
}

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
const money = (n) => `NT$${Math.round(n).toLocaleString('en-US')}`;

if (cmd === 'brands') {
  const { rows, note } = await all('main-merchant.php', {});
  if (note) console.log(note);
  for (const b of rows) {
    const deals = (b.commission ?? []).map((c) => `${c.deals_names} ${c.deals_type === '0' ? `${c.deals_num}%` : `${c.deals_num}元`}${c.is_campaign ? `（加碼 ${c.campaign_num}，${c.campaign_duration}）` : ''}`).join('、');
    console.log(`${b.merchant_id}  ${b.merchant_name}　${deals}　確認期 ${b.order_confirmation_days} 天、入帳 ${b.order_payment_days} 天${b.is_instant === '1' ? '、訂單即時' : ''}`);
  }
} else if (cmd === 'orders') {
  const end = new Date();
  const start = new Date(Date.now() - DAYS * 864e5);
  const { rows, note } = await all('main-index.php', {
    order_date_type: 'create_date', order_start_time: ymd(start), order_end_time: ymd(end),
  }, 1000);
  console.log(`訂單成立 ${ymd(start)}～${ymd(end)}：${rows.length} 筆${note ? `（${note}）` : ''}`);
  if (rows.length) {
    const by = new Map();
    for (const o of rows) {
      const k = `${o.advertisers_name}｜${o.commission_status}`;
      const v = by.get(k) ?? { n: 0, price: 0, pre: 0, confirm: 0 };
      v.n++; v.price += Number(o.order_price) || 0; v.pre += Number(o.pre_commission) || 0; v.confirm += Number(o.confirm_commission) || 0;
      by.set(k, v);
    }
    console.log('\n品牌｜獎金狀態　筆數　訂單金額　預計獎金　確認獎金');
    for (const [k, v] of [...by].sort((a, b) => b[1].pre - a[1].pre)) {
      console.log(`${k}　${v.n}　${money(v.price)}　${money(v.pre)}　${money(v.confirm)}`);
    }
  }
} else {
  console.error(`不認得的子指令：${cmd}（可用 orders、brands）`);
  process.exit(1);
}
