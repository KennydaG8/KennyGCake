# KennyG Cake Group Buy API

Phase 2 Cloudflare Worker and D1 backend for enterprise campaigns. It is isolated from the public homepage and the Raspberry Pi LINE services. LINE Pay network calls are intentionally not implemented until Phase 3 Sandbox.

## Local verification

```text
npm install
npm run check
npm test
```

Apply migrations locally with Wrangler before running the Worker:

```text
npx wrangler d1 migrations apply kennygcake-group-buy --local
npm run dev
```

Copy `.dev.vars.example` to the ignored `.dev.vars` and replace its example value for local development. Never commit `.dev.vars`.

## API

- `GET /health`
- `GET /v1/campaigns/:campaignId`
- `GET /v1/campaigns/:campaignId/progress`
- `POST /v1/campaigns/:campaignId/orders`

Campaign endpoints require `Authorization: Campaign <access-token>`. Order requests accept customer fields plus only `productId` and `quantity`; client prices are rejected and totals are recalculated from active D1 campaign products.

## Phase 2 boundaries

- Creates only `PENDING` orders.
- Does not request, confirm, cancel, or query LINE Pay transactions.
- Does not deploy a Worker or D1 database.
- Does not change DNS, Cloudflare Tunnel, Raspberry Pi services, or the existing LINE webhook.
