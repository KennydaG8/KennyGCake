# 公信電子企業團購 Production 上線確認清單

> 狀態：已取得啟用指令，2026-09-15 正式啟用。

## 活動與時間（待確認）

- [x] 現場開放預購日期：**2026-09-17**
- [x] 結單時間：**2026-09-17 14:00（Asia/Taipei）**
- [x] 統一取貨日期：**2026-09-21**
- [ ] 員工取貨時段：**12:00–13:00**
- [ ] 取貨方式：公司統一配送／員工現場領取

## 成團與商品

- [ ] 成團免運門檻：**NT$1,000**
- [x] 正式商品僅三項：經典原味、濃香抹茶、醇厚巧克力
- [x] 三種口味任選 **2 顆 NT$150**；奇數多出的 1 顆按 **NT$85**
- [x] NT$1 TEST 商品已停用，且不出現在團購頁
- [x] TEST Order 已排除正式營業額、成團進度、訂單數與製作數量

## 隱私與入口

- [x] Campaign visibility 為 `UNLISTED`
- [x] Campaign 需私人 Access Token
- [x] 頁面設定 `noindex, nofollow, noarchive`
- [x] Access Token 位於 URL fragment，不送入 HTTP access log
- [ ] QR Code 僅交付活動負責人並於核准後發放

## 上線前技術檢查

- [x] Production LINE Pay E2E 已通過
- [x] Confirm、PAID、idempotency、D1 audit 已通過
- [x] Production payment allowlist 目前為空
- [x] Campaign 目前為 `DRAFT`
- [x] 依最終日期更新 D1 Campaign 時程
- [ ] 最終 smoke test：頁面、三項商品、手機格式、Request Payment
- [x] Campaign 已切換為 `ACTIVE`
- [x] Production payment allowlist 已設為 `gongxin`

## 上線後立即確認

- [ ] 私人 QR 可開啟 Campaign
- [ ] 無 Token／錯誤 Token 無法取得 Campaign
- [ ] Aggregate Progress 起始值不包含 TEST audit
- [ ] Pi LINE Bot、既有 LINE Pay、Webhook、Tunnel、DNS 均未變更
