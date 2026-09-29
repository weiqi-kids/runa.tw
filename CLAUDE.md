# runa.tw — 月奈創角｜AI產品嚴選

給人看的選品網站＋給 LLM 引用的產品知識庫。純靜態：Astro 7 → GitHub Pages（repo `weiqi-kids/runa.tw`，自訂網域 `runa.tw`）。

## 收手前一定要跑

```
pnpm verify     # build → 站內連結檢查 → 測試（字級、hex、草稿收錄規則）
```

## 資料模型

`src/content.config.ts` 是唯一定義。六種 Entity：`products`（核心）、`categories`、`needs`、`comparisons`、`guides`、`brands`。
影音掛在 `products[].media`，不另開集合；`/media/` 只是彙整頁。
嚴選分區（最新、本月、編輯、黑科技、冷門好物、值得關注）是 `products[].picks` 標籤，不是獨立網址。

## 不可以違反

1. **可空不可推論。** 官網沒寫的欄位就不填，不補「合理的預設值」。功效描述一律放「品牌宣稱（本站未驗證）」。
2. **價格一定帶 `asOf` 與 `source`。** 不採信原價與「現省」，比較一律用售價重算，算式寫在頁面上。
3. **每個產品至少一項 `cons`、一項 `notFitFor`。** schema 擋著。
4. **`status` 預設 draft。** draft → noindex、無 JSON-LD、不進 sitemap／llms.txt、頁首掛「草稿・未實測」。實測完才改 `published`，published 必須有 `sources`。
5. **網址發出就不變。** 檔名＝slug。改名要做 301。
6. **YAML 陣列裡有千分位逗號要加引號**：`['NT$4,380']`，否則會被拆成兩個值。

## 視覺方向

2026-09-29 月奈選定 **A 雜誌風**：暖奶油底、莓果粉主色、奶油黃貼紙、手寫感標題（霞鶩文楷）、拍立得與貼紙拼貼。之後的頁面都沿用 `site.css` 的 `a-*` 元件，不另起風格。
用語一律台灣用法，不用「種草」這類中國用語。

## 設計 token

`src/styles/tokens.css` 是上游副本（`pnpm sync:tokens`），不要直接改。站台樣式寫在 `site.css`：
字級只用 `var(--text-*)`（最小 18px），顏色只用 token 或 `oklch()`，不寫 hex。`test/style-tokens.test.mjs` 擋著。

## 上線

push 到 `main` → `.github/workflows/deploy.yml` 以 `PUBLIC_SITE_STAGE=production` 建置、跑 `pnpm verify`、部署 GitHub Pages。
本機 `pnpm build` 是開發建置：全站 noindex＋robots 全擋（測試有反例擋著），不會誤開收錄。

- 網域：`public/CNAME`＝`runa.tw`。DNS 在 GoDaddy（`domaincontrol.com`）：`@` 四筆 A 指 GitHub Pages，`www` CNAME 指 `weiqi-kids.github.io`。
- GA4／GSC：repository variables `RUNA_GA_ID`（`G-` 開頭）、`RUNA_GSC_TOKEN`（`google-site-verification` 的 content 值）。改了要重新部署才生效：`gh workflow run deploy -R weiqi-kids/runa.tw`。
- GA 只在正式建置輸出，本機預覽不送資料。
