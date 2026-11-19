# 企業同仁訂購：Email 收件器設定

The order page is `https://kennygcake.com/order/?c=<公司代碼>`. It is not linked from the homepage and it is `noindex`.

When someone submits an order, it goes to this Google Apps Script. The script adds a row to a Google Sheet and emails the Google account that deployed it.

## First-time setup (about 5 minutes)

1. Open https://sheets.new and create a sheet, for example 「KennyG 企業訂單」.
2. In the menu choose **擴充功能 → Apps Script**. Delete the default code and paste in all of `Code.gs`. Save.
3. Select the `testOrder` function at the top and press **執行**. Allow the permissions it asks for. Your Gmail should then receive a test email, and the sheet should gain a 「企業訂單」 tab.
4. Click **部署 → 新增部署作業**:
   - Type: **網頁應用程式**
   - Execute as: **我**
   - Who has access: **所有人**
5. Copy the **網頁應用程式網址** (it ends in `/exec`) and paste it into `ORDER_ENDPOINT` in `order/order.js`.

After you edit `Code.gs`, choose **部署 → 管理部署作業 → 編輯 → 版本：新版本**. Updating this way keeps the same URL.

## Adding a company

Add one entry to `COMPANIES` in `order/order.js`:

```js
somecorp: { name: "某某公司", address: "公司地址" },
```

The company's link is `https://kennygcake.com/order/?c=somecorp`.

The default price is NT$76 for a minimum of 12. To give one company a different price:

1. Add `unitPrice` to that company's entry in `order.js`.
2. Add the same price to `UNIT_PRICES` in `Code.gs`.
