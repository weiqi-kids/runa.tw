import type { APIRoute } from 'astro';
import { IS_PRODUCTION } from '../lib/site';

// 開發期全擋；正式站全開，並把生成式引擎的爬蟲明列出來——讓「開放」是明確的決定而不是預設值。
// 這個站的目標就是被 LLM 引用。要改成不開放時改這裡。
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent',
];

export const GET: APIRoute = ({ site }) => {
  const origin = site!.toString().replace(/\/$/, '');
  const body = IS_PRODUCTION
    ? ['User-agent: *', 'Allow: /', '', ...AI_BOTS.flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
       `Sitemap: ${origin}/sitemap-index.xml`, ''].join('\n')
    : ['# 開發站：全站不收錄。切正式網域時以 PUBLIC_SITE_STAGE=production 建置。', 'User-agent: *', 'Disallow: /', ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
