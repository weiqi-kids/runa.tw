# iChannels（通路王）Web API 摘要

來源：https://www.ichannels.com.tw/sitemember_new/html-page.php?pid=webapi （需登入聯盟會員），2026-09-29 讀取。
這份只整理和 runa.tw 有關的欄位；完整欄位以原文件為準。範例值（`oRivsWVCwpexLdwwkj`、`af100000001`）是文件自己的範例，不是我們的帳號。

## runa.tw 目前的做法（2026-09-29）

**Web API 金鑰已取得（2026-10-01）**：放在 `.env` 的 `ICHANNELS_KEY`，推廣代碼 `ICHANNELS_MEMBER_CODE`（`af` 開頭，會員後台頁面原始碼裡找得到）。金鑰要等會員資料四項都審核通過才會出現在 API 手冊右上角。

所以購買連結改用不需要金鑰的 **Deep Link（新中央轉址）**，實作在 `src/lib/affiliate.ts`：

```
https://product.mchannles.com/redirect_wa.php?k=<K值>&tourl=<URL encode 後的品牌網址>
```

- K 值取自「推廣工具 → 網址自動轉換器 → 產生推廣碼」程式碼裡的 `oeya_member`，不是機密。
- 只對「申請狀態＝可推廣」的品牌有效。品牌在 `src/content/brands/*.md` 設 `affiliate` 才會轉換。
- 2026-09-29 實測 KORENA 商品頁：轉址 2 次後落在官網商品頁，網址帶追蹤參數 `gid`。中間轉址主機偶爾逾時。
- 訂單與獎金：`pnpm orders`（訂單 API）；已加入推廣的品牌：`pnpm orders brands`（品牌 API 只列加入過的品牌，完整清單仍要從後台匯出）。
- API 只有 `http`，`https` 連不上（2026-10-01 實測）。

## 共通

- 以 HTTP GET 呼叫，文件上的網址都是 `http://api.ichannels.com.tw/sitemember/...`（金鑰在查詢字串裡，實作時先試 https）。
- 必帶 `key`（金鑰，顯示在 API 手冊右上角，**機密**）與 `member_code`（推廣代碼，會出現在推廣連結裡，不是機密）。
- 回應固定三個欄位：`response_status`（0 失敗、1 成功）、`total`、`data`。
- 分頁：`page`，預設每頁 10 筆。

### 品牌分類代碼（`manu_cate`）

27 3C家電、28 金融理財、29 服飾精品、30 購物商城、31 家居生活、32 媽咪寶貝、33 旅遊訂房、34 美容保養、35 美食特產、37 書籍雜誌、38 網路服務、39 醫護保健、40 休閒影音、41 線上遊戲、42 教育學習、43 其他類別、47 寵物水族、48 汽車交通、49 醫美診所、50 銀髮樂齡、51 公家機關、52 運動戶外

### 廣告類型代碼（`ad_type`）

1 推廣貼紙、3 新聞稿、4 試用文、5 電子報、6 促銷活動、7 Landing Page

## 產生推廣連結 `main-url.php`

把品牌網址轉成可追蹤的推廣網址。**runa.tw 的購買按鈕主要用這支。**

| 參數 | 說明 |
|---|---|
| `url` | 品牌網址，先 URL encode；多個用半形逗號隔開（批次） |
| `uid1`～`uid5` | 成效標籤，會出現在訂單 API 的 `ad_uid1`～`ad_uid5` |

回應：`gen_date`、`gen_url`（多個用逗號隔開）。錯誤 `error_url` 會在 `[]` 列出失敗的網址（該品牌不支援推廣）。

## 品牌 `main-merchant.php`

合作品牌清單與佣金條件。參數 `manu_cate`（可選）、`page`。

回應重點：`merchant_name`、`merchant_id`、`merchant_url`、`order_confirmation_days`（訂單確認期）、`order_payment_days`（獎金入帳期）、`is_instant`、`deals_names`、`deals_type`（0 拆分 %、1 固定金額）、`deals_num`、`deals_condition`、`is_campaign`／`campaign_duration`／`campaign_num`／`campaign_type`（加碼）。

## 訂單 `main-index.php`

成效與獎金。參數：`order_date_type`（`create_date` 訂單成立／`business_date` 成效確認／`order_date` 獎金確認／`modified_date` 更新，預設 `create_date`）、`order_start_time`、`order_end_time`（`YYYYMMDD`）、`page`、`page_size`（最多 1000）、`commission_status`（1 確認中、3 確認訂單未入帳、4 已成交入帳、5 無效；可選）、`ad_uid1`～`ad_uid5`、`manu_name`（可選，URL encode）。

回應重點：`advertisers_name`、`order_num`、`order_price`、`pre_commission`（預計獎金）、`commission_status`、`confirm_commission`（確認獎金）、`order_goods`、`order_amount`、`order_date`、`merchant_id`、`ad_uid1`～`ad_uid5`。

## 優惠券 `main-eventscoupons.php`

參數 `manu_cate`、`merchant_id`（皆可選）、`page`。回應含 `merchant_*`、`c_id`、`pic`、`type`（例：序號型）等。

## 廣告素材 `main-advertisers.php`

參數 `ad_type`、`manu_cate`、`merchant_id`、`page`。回應含 `ad_id`、`ad_type`、`merchant_*`、`ad_site`（已帶推廣代碼）、`ad_content`（HTML）。

## 商品 `main-goods.php`

只限 Mymall 上架商品。參數 `manu_cate`、`page`。回應含商品名稱、價格（`goods_sale_price`、`goods_sug_price`）、圖片、推廣網址 `goods_ad_site` 等。
