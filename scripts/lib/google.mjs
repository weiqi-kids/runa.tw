// GSC／GA API 共用：以 gcloud 使用者 token 模擬服務帳號 runa-index@runa-tw，不下載金鑰、token 不印出來。
import { execFileSync } from 'node:child_process';

export const SA = 'runa-index@runa-tw.iam.gserviceaccount.com';
export const GSC_SITE = 'sc-domain:runa.tw';
export const ORIGIN = 'https://runa.tw';
// GA4 資源 ID（數字，不是 G- 開頭的評估 ID）。資源名稱 runa.tw，網站串流評估 ID G-7Z4DRRB2WM。
export const GA_PROPERTY = process.env.RUNA_GA_PROPERTY || '556506274';

export async function googleToken(scopes = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/analytics.readonly',
]) {
  let userToken;
  try {
    userToken = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('拿不到 gcloud token。先跑 `gcloud auth login`。');
  }
  const r = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:generateAccessToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: scopes, lifetime: '3600s' }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`模擬服務帳號失敗：${JSON.stringify(j).slice(0, 300)}`);
  return j.accessToken;
}

export function client(token) {
  return async (url, body, method) => {
    const r = await fetch(url, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
}

// GSC 資料有 2–3 天延遲，期間不含今天
export function period(days = 28) {
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(new Date(Date.now() - days * 864e5)), end: iso(new Date(Date.now() - 864e5)) };
}
