# runa.tw — 月奈創角｜AI產品嚴選

給人看的選品網站＋給 LLM 引用的產品知識庫。純靜態：Astro 7 → GitHub Pages（repo `weiqi-kids/runa.tw`，自訂網域 `runa.tw`）。

## 收手前一定要跑

```
pnpm verify     # build → 站內連結檢查 → 測試（字級、hex、草稿收錄規則）
```

**改功能就同步改文件**：這份 CLAUDE.md、`docs/選品SOP.md`、`docs/ichannels-api.md`，跟程式在同一個 commit 更新，不要留到之後。

## 指令一覽

| 指令 | 做什麼 |
|---|---|
| `pnpm dev`／`pnpm build` | 開發伺服器／開發建置（全站 noindex） |
| `pnpm verify` | 建置＋連結檢查＋測試；正式站條件：`PUBLIC_SITE_STAGE=production pnpm verify` |
| `pnpm seo [index\|traffic\|clicks\|audience\|submit]` | GSC 收錄與曝光、GA 流量、購買按鈕點擊、讀者輪廓、提交 sitemap |
| `pnpm orders [brands] [--days N]` | iChannels 訂單與獎金、已加入的品牌（金鑰在 `.env`） |
| `pnpm picks [--top N] [--offline]` | 選品候選排名（見 `docs/選品SOP.md`） |
| `pnpm sync:tokens` | 從上游同步設計 token |

## 資料模型

`src/content.config.ts` 是唯一定義。六種 Entity：`products`（核心）、`categories`、`needs`、`comparisons`、`guides`、`brands`。
影音掛在 `products[].media`，不另開集合；`/media/` 只是彙整頁。
嚴選分區（最新、本月、編輯、黑科技、冷門好物、值得關注）是 `products[].picks` 標籤，不是獨立網址。

## 不可以違反

1. **可空不可推論。** 官網沒寫的欄位就不填，不補「合理的預設值」。功效描述一律放「品牌宣稱（本站未驗證）」。
2. **價格一定帶 `asOf` 與 `source`。** 不採信原價與「現省」，比較一律用售價重算，算式寫在頁面上。
3. **每個產品至少一項 `cons`、一項 `notFitFor`。** schema 擋著。
4. **`status` 預設 draft。** draft → noindex、無 JSON-LD、不進 sitemap／llms.txt、頁首掛「草稿・未實測」。實測完才改 `published`，published 必須有 `sources`。
   正式站的列表頁（首頁、嚴選、品類、需求、比較列表、搜尋）只列 published（`listed()`），草稿只能用直接網址打開給站主審閱。測試擋著。
5. **網址發出就不變。** 檔名＝slug。改名要做 301。
6. **YAML 陣列裡有千分位逗號要加引號**：`['NT$4,380']`，否則會被拆成兩個值。
7. **產品頁只給要上架的產品**（自家選品、可分潤）。競品只放在比較頁的 `externals`：只在比較表出現，不建產品頁、不放購買連結，官方網址只當資料來源。

## 選品

流程照 `docs/選品SOP.md`：`pnpm picks` 出候選（品牌條件 × 站上定位 × GSC／GA 需求），人工篩選後才建頁。
品牌清單匯出在 `data/private/`（會員限定資料，不進版控）。

## 聯盟行銷

購買按鈕由 `src/lib/affiliate.ts` 依品牌的 `affiliate` 設定自動轉成 iChannels 推廣連結（Deep Link，不需金鑰），頁面標「聯盟連結」、`rel="sponsored"`。
產品的 `buy.url` 一律填品牌官網原始網址。細節與 API 文件摘要在 `docs/ichannels-api.md`。
購買按鈕點擊送 GA 事件 `buy_click`（自訂維度 `product_id`、`brand_id`、`placement`、`affiliate`），用 `pnpm seo clicks` 看。

## 視覺方向

2026-09-29 月奈選定 **A 雜誌風**：暖奶油底、莓果粉主色、奶油黃貼紙、手寫感標題（霞鶩文楷）、拍立得與貼紙拼貼。之後的頁面都沿用 `site.css` 的 `a-*` 元件，不另起風格。
用語一律台灣用法，不用「種草」這類中國用語。

## 其他自動化

`src/lib/llms-full.ts` 是另一個自動化（auto-claude-reflect）加進來的。改產品或比較的資料結構時，要確認它還能建置（例：比較頁加 `externals` 時它讀 `pickIf.product` 的地方一起改過）。
`data/seo-daily/` 是 seo-ops 的每日數據，不進版控。

## 設計 token

`src/styles/tokens.css` 是上游副本（`pnpm sync:tokens`），不要直接改。站台樣式寫在 `site.css`：
字級只用 `var(--text-*)`（最小 18px），顏色只用 token 或 `oklch()`，不寫 hex。`test/style-tokens.test.mjs` 擋著。

## 上線

push 到 `main` → `.github/workflows/deploy.yml` 以 `PUBLIC_SITE_STAGE=production` 建置、跑 `pnpm verify`、部署 GitHub Pages。
本機 `pnpm build` 是開發建置：全站 noindex＋robots 全擋（測試有反例擋著），不會誤開收錄。

- 網域：`public/CNAME`＝`runa.tw`。DNS 在 GoDaddy（`domaincontrol.com`）：`@` 四筆 A 指 GitHub Pages，`www` CNAME 指 `weiqi-kids.github.io`。
- GA4：資源 `properties/556506274`（runa.tw），網站串流評估 ID `G-7Z4DRRB2WM`，事件資料保留 14 個月。
  評估 ID 用這個串流自己的 ID（2026-09-29 以一般瀏覽器瀏覽後，即時報表有收到事件）。
  驗證時要用一般瀏覽器：GA4 會過濾 HeadlessChrome，無頭瀏覽器的測試永遠看不到資料。
- GA4／GSC 的值：repository variables `RUNA_GA_ID`（`G-` 開頭）、`RUNA_GSC_TOKEN`（`google-site-verification` 的 content 值）。改了要重新部署才生效：`gh workflow run deploy -R weiqi-kids/runa.tw`。
- GA 只在正式建置輸出，本機預覽不送資料。
- GSC 用「網域」資源 `sc-domain:runa.tw`（GoDaddy DNS 的 TXT 驗證）。
- 現況查詢：`pnpm seo`（收錄、曝光、GA4 流量）、`pnpm seo submit`（提交 sitemap）。以 gcloud 使用者身分模擬服務帳號 `runa-index@runa-tw.iam.gserviceaccount.com`（GCP 專案 `runa-tw`），不下載金鑰。這份文件不寫現況數字，要看就跑指令。
