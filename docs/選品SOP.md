# 選品 SOP

從 iChannels 的合作品牌裡，找出適合放進月奈嚴選的產品，上架、追蹤、再根據成效調整。

**這份文件不寫現況數字。** 候選排名、曝光、點擊每天都在變，要看就跑指令。

## 誰做什麼

| 角色 | 負責 |
|---|---|
| Claude | 匯出品牌清單、跑候選排名、研究官網、建產品頁草稿、拉 GSC／GA 報表 |
| 月奈 | 從候選裡挑、實際使用、拍影音、決定發布、調整站上定位（分類權重） |

入選一定要經過人：分數只反映「佣金條件＋站上定位＋需求訊號」，不代表產品好不好用。

## 流程

```mermaid
flowchart LR
  A["1 匯出品牌清單<br/>每月"] --> B["2 pnpm picks<br/>候選排名"]
  B --> C["3 人工篩選<br/>檢查表"]
  C --> D["4 研究官網<br/>建產品頁草稿"]
  D --> E["5 實測、拍影音"]
  E --> F["6 發布"]
  F --> G["7 追蹤成效<br/>pnpm seo"]
  G --> H["8 每月檢討<br/>調權重與關鍵字"]
  H --> B

  style A fill:#e8f0fc,stroke:#2a6bb8,stroke-width:2px,color:#1e2030
  style B fill:#e8f0fc,stroke:#2a6bb8,stroke-width:2px,color:#1e2030
  style D fill:#e8f0fc,stroke:#2a6bb8,stroke-width:2px,color:#1e2030
  style G fill:#e8f0fc,stroke:#2a6bb8,stroke-width:2px,color:#1e2030
  style C fill:#fcf5e8,stroke:#8a7020,stroke-width:2px,color:#1e2030
  style E fill:#fcf5e8,stroke:#8a7020,stroke-width:2px,color:#1e2030
  style H fill:#fcf5e8,stroke:#8a7020,stroke-width:2px,color:#1e2030
  style F fill:#ecedf0,stroke:#1e8050,stroke-width:2px,color:#1e2030
  linkStyle default stroke:#8a8c98,stroke-width:2px
```

藍色是 Claude 做，黃色要月奈判斷，灰色是發布。

## 三個階段

評分公式一樣，差在需求訊號有沒有數據。

| 階段 | 何時 | 候選排名靠什麼 |
|---|---|---|
| 冷啟動 | 上線後到 GSC 開始出現查詢字詞（通常 2–4 週） | 品牌條件（佣金、EPC、Cookie、免審核）× 站上定位 |
| 數據期 | GSC 有查詢字詞、GA 有內容頁瀏覽 | 上面再乘需求加成：搜尋與閱讀最多的分類最多 ×1.5 |
| 成熟期 | 有 iChannels 訂單之後 | 再加上實際訂單與獎金（`pnpm orders`） |

## 步驟

### 1. 匯出品牌清單（每月一次）

跟 Claude 說「更新 iChannels 品牌清單」。Claude 用已登入的 Chrome 讀會員後台「搜尋品牌」，逐一分類標註後存成：

```
data/private/ichannels-brands-YYYYMMDD.psv
```

`data/private/` 不進版控：佣金條件是會員限定資料，repo 是公開的。

### 2. 跑候選排名

```
pnpm picks              # 前 30 名＋各分類前 5 名，同時寫到 data/private/picks-YYYYMMDD.md
pnpm picks --top 50
pnpm picks --offline    # 沒有 gcloud 權限時，跳過 GSC／GA
```

分數怎麼算（`scripts/pick-candidates.mjs`）：

```
分數 = 分類權重 ×（佣金 45% ＋ 30天EPC 25% ＋ Cookie 20% ＋ 免審核 10%）× 需求加成
```

- **佣金**：CPS 取最高的 %，20% 算滿分；名單型（CPL／CPA）用固定金額，500 元算滿分。
- **30 天 EPC**：iChannels 全平台每次點擊平均獎金，代表「真的有人買」，取對數避免單一品牌壓過全部。
- **Cookie**：30 天算滿分。1 天以下會標「Cookie≤1天」：讀者當天沒買就不算。
- **分類權重**：站上定位，是編輯判斷不是數據，寫在腳本最上面的 `FIT`。權重 0 的分類不列入：金融理財（多是借貸名單，和「嚴選」的信任定位衝突）、購物商城（平台不是產品）、其他類別。
- **需求加成**：GSC 查詢字詞依 `QUERY_HINTS` 歸到分類，GA 內容頁瀏覽依 `PAGE_HINTS` 歸到分類。沒數據時全部 ×1。

「注意」欄的標記：

| 標記 | 意思 | 怎麼處理 |
|---|---|---|
| 要先申請 | 後台狀態是「申請」，還不能推廣 | 到後台送申請，核准前不建頁 |
| 舊品牌先確認營運 | 編號小、EPC 為 0，多是早期 Mymall 店家 | 先打開官網確認還在賣 |
| 服務型 | 沙龍、課程、訂閱、寬頻等 | 很難寫成產品知識頁，除非月奈實際體驗過 |
| Cookie≤1天 | 追蹤期很短 | 只適合「看完就會買」的低價商品 |
| 固定金額（名單型） | 按名單或註冊付費，不是按銷售 | 確認和嚴選定位相符再做 |
| 加碼中 | 目前有佣金加碼 | 加碼有期限，不要當成選它的主要理由 |

### 3. 人工篩選（月奈）

從候選裡挑 1–3 個，每個都要過這張檢查表。有一項答不出來就換下一個。

- [ ] 官網還在營運，有具體商品頁可以連
- [ ] 月奈願意實際使用（或已經用過）
- [ ] 寫得出至少一項缺點、一種「不適合的人」
- [ ] 跟站上現有的品類或需求頁接得起來，或值得開新品類
- [ ] 官網的功效宣稱不會讓我們踩線（化粧品、保健食品的誇大宣稱只能引述，標「品牌宣稱」）

### 4. 研究官網、建產品頁草稿（Claude）

跟 Claude 說「幫我建 ○○ 的產品頁，官網是 …」。Claude 照 KORENA 的格式做：

- `src/content/products/<slug>.md`，`status` 先不填（預設 draft，不收錄）
- 品牌不在站上：新增 `src/content/brands/<id>.md`，填 `affiliate`（iChannels 品牌編號、佣金條件、查閱日期），購買按鈕就會自動換成推廣連結
- 價格一定帶查閱日期與官網連結；組合內容逐項列清楚
- 有兩個以上同類產品，順便做比較頁與「我適合哪一組」
- **要拿競品來比較時，不替競品建產品頁**：寫在比較頁的 `externals`（名稱、品牌、官方資料來源），只在比較表出現、沒有購買連結。功效一律標「品牌宣稱」，使用體驗留「待實測」

### 5. 實測、拍影音（月奈）

- 實際使用後，把心得寫進產品頁的「月奈怎麼看」
- 影片、Reels 的網址填進產品的 `media`，產品頁會自動顯示，影音頁也會彙整
- 影片說明欄放產品頁網址，讓社群流量回到站上

### 6. 發布

產品頁加上 `status: published`，更新紀錄加一筆「發布」，推到 `main` 就會自動部署。之後跑 `pnpm seo submit` 重新提交 sitemap。

### 7. 追蹤成效

```
pnpm seo index     # 收錄：新頁有沒有被 Google 收進去
pnpm seo traffic   # 曝光、點擊、查詢字詞、GA 流量來源
pnpm seo clicks    # 各產品購買按鈕被點了幾次（GA 事件 buy_click）
pnpm seo audience  # 讀者年齡、性別、興趣、裝置（Google 信號 2026-09-29 開啟）
```

```
pnpm orders        # 近 30 天 iChannels 訂單，按品牌與獎金狀態彙總（--days 90 看更久）
pnpm orders brands # 已加入推廣的品牌與佣金條件
```

### 8. 每月檢討（月奈＋Claude）

跑一次 `pnpm seo traffic`、`pnpm seo clicks`、`pnpm seo audience`，對照下面四件事：

| 看到什麼 | 怎麼調 |
|---|---|
| 某分類的查詢字詞多，但站上產品少 | 那一類優先補產品；查詢字詞沒被歸類就補進 `QUERY_HINTS` |
| 某產品頁曝光多、購買點擊少 | 檢查一句話結論和價格是否吸引人，考慮做比較頁 |
| 某產品頁 60 天沒有曝光也沒有點擊 | 不刪頁（網址永久不變），但不再投入影音資源 |
| 讀者的年齡、性別、興趣跟現有品類對不上 | 調 `FIT` 權重，往讀者興趣的分類挪 |

調整 `FIT` 權重時，在下面的修訂紀錄記一筆原因。

## 修訂紀錄

- 2026-09-29：初版。分類權重為初始設定，美妝保養最高（站上第一個品類），月奈確認沿用。
- 2026-09-29：GA 開啟 Google 信號，每月檢討加看讀者輪廓（`pnpm seo audience`）。
- 2026-10-01：取得 iChannels Web API 金鑰，`pnpm orders` 可查訂單與獎金。
- 2026-10-01：競品只放比較頁 `externals`，不建產品頁；草稿不出現在正式站列表頁。
