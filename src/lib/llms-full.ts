// /llms-full.txt：llms.txt 的完整版。AI 取全文用，不用再逐頁爬——但只收 published，
// 理由跟 llms.txt 一樣：草稿沒查證，不該被當成可引用的事實。
// 透過 astro.config.mjs 的 injectRoute 掛路由（entrypoint 指到這裡），不進 src/pages。
import type { APIRoute } from 'astro';
import { published, path, ymd, twd, SITE_NAME, TAGLINE } from './site';
import { CON_KINDS } from '../content.config';

type Src = { title: string; url: string; publisher?: string; accessedAt: Date };
type Faq = { q: string; a: string };

const citeBlock = (sources: Src[]) => sources.length
  ? ['', '資料來源：', ...sources.map((s) => `- ${s.title}${s.publisher ? `（${s.publisher}）` : ''}・查閱於 ${ymd(s.accessedAt)}：${s.url}`)]
  : [];

const faqBlock = (faq: Faq[]) => faq.length
  ? ['', '常見問題：', ...faq.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`])]
  : [];

export const GET: APIRoute = async ({ site }) => {
  const o = site!.toString().replace(/\/$/, '');
  const [products, categories, needs, cmps, guides] = await Promise.all([
    published('products'), published('categories'), published('needs'), published('comparisons'), published('guides'),
  ]);

  const productBlocks = products.map((p) => {
    const d = p.data;
    return [
      `## 產品：${d.name}`, `網址：${o}${path.product(p.id)}`,
      `一句話結論：${d.verdict}`,
      `適合誰：${d.fitFor.join('；')}`,
      `不適合誰：${d.notFitFor.join('；')}`,
      `優點：${d.pros.join('；')}`,
      `缺點：${d.cons.map((c) => (c.kind ? `［${CON_KINDS[c.kind]}］` : '') + c.text).join('；')}`,
      ...(d.price ? [`價格：${twd(d.price.amount)}（${ymd(d.price.asOf)} 查閱，${d.price.source}）`] : []),
      ...faqBlock(d.faq),
      '', p.body?.trim() ?? '',
      ...citeBlock(d.sources),
      '',
    ].join('\n');
  });

  const categoryBlocks = categories.map((c) => {
    const d = c.data;
    return [
      `## 品類：${d.name}`, `網址：${o}${path.category(c.id)}`,
      `怎麼選：${d.answer}`,
      ...(d.whoNeedsIt.length ? [`適合誰：${d.whoNeedsIt.join('；')}`] : []),
      ...(d.howToChoose.length ? ['', '挑選重點：', ...d.howToChoose.map((h) => `- ${h.factor}：${h.detail}`)] : []),
      ...faqBlock(d.faq),
      '', c.body?.trim() ?? '',
      ...citeBlock(d.sources),
      '',
    ].join('\n');
  });

  const needBlocks = needs.map((n) => {
    const d = n.data;
    return [
      `## 需求：${d.name}`, `網址：${o}${path.need(n.id)}`,
      `怎麼解：${d.answer}`,
      ...(d.problems.length ? ['', '問題與解法：', ...d.problems.map((pr) => `- ${pr.problem} → ${pr.solution}`)] : []),
      ...faqBlock(d.faq),
      '', n.body?.trim() ?? '',
      '',
    ].join('\n');
  });

  const cmpBlocks = cmps.map((c) => {
    const d = c.data;
    return [
      `## 比較：${d.title}`, `網址：${o}${path.comparison(c.id)}`,
      `結論：${d.answer}`,
      ...(d.pickIf.length ? ['', '怎麼選：', ...d.pickIf.map((pi) => `- ${pi.if} → 選 ${pi.product?.id ?? d.externals.find((e) => e.id === pi.external)?.name ?? pi.external}`)] : []),
      ...faqBlock(d.faq),
      '', c.body?.trim() ?? '',
      ...citeBlock(d.sources),
      '',
    ].join('\n');
  });

  const guideBlocks = guides.map((g) => {
    const d = g.data;
    return [
      `## 指南：${d.title}`, `網址：${o}${path.guide(g.id)}`,
      `結論：${d.answer}`,
      ...faqBlock(d.faq),
      '', g.body?.trim() ?? '',
      ...citeBlock(d.sources),
      '',
    ].join('\n');
  });

  const sections = [productBlocks, categoryBlocks, needBlocks, cmpBlocks, guideBlocks];
  const body = [
    `# ${SITE_NAME} — 全文`,
    '',
    `> ${TAGLINE}這是 llms.txt 的完整版：已發布頁面的完整內文與資料來源，供 AI 直接引用，不需再逐頁爬取。`,
    '',
    '- **價格有日期，活動價會變動；引用時請一併帶上查閱日期。**',
    '- **「品牌怎麼說」段落是官網原文，本站未驗證功效。**',
    '- **草稿頁不在這份清單裡，尚未完成查證。**',
    '',
    ...(sections.every((s) => s.length === 0)
      ? ['目前沒有已完成查證的頁面。', '']
      : sections.flat()),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
