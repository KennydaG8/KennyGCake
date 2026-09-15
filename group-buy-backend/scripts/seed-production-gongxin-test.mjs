import { createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Entry } from "@napi-rs/keyring";
import { promptSecret } from "./secure-prompt.mjs";
const pepper=await promptSecret("Enter the Production CAMPAIGN_TOKEN_PEPPER configured in Cloudflare (hidden): "); if(Buffer.byteLength(pepper,"utf8")<32) throw new Error("Pepper must contain at least 32 bytes");
const token=randomBytes(32).toString("base64url"), digest=createHmac("sha256",pepper).update(`campaign:gongxin:${token}`).digest("hex"), t=new Date().toISOString(), q=v=>`'${String(v).replaceAll("'","''")}'`;
const sql=[
 `INSERT INTO campaigns(id,company_name,campaign_name,visibility,status,access_token_digest,order_deadline,delivery_date,delivery_start_time,delivery_end_time,delivery_method,delivery_fee,free_delivery_threshold,note,created_at,updated_at,is_test) VALUES('gongxin',${q('公信電子')},${q('公信電子員工限定團購')},'UNLISTED','ACTIVE','${digest}','2026-12-31T15:59:59.000Z','2027-01-15','12:00','13:00',${q('公司統一配送／員工現場領取')},0,1000,${q('PRIVATE PRODUCTION E2E — NOT OPEN TO EMPLOYEES')},'${t}','${t}',0)`,
 `INSERT INTO products(id,name,image_url,active,created_at,updated_at,is_test) VALUES('original',${q('經典原味')},'../images/basque-original-cut.png',1,'${t}','${t}',0),('matcha',${q('濃香抹茶')},'../images/basque-matcha-cut.png',1,'${t}','${t}',0),('chocolate',${q('醇厚巧克力')},'../images/basque-chocolate-cut.png',1,'${t}','${t}',0),('prod-e2e-nt1',${q('TEST NT$1 — DO NOT FULFILL')},'/none',1,'${t}','${t}',1)`,
 `INSERT INTO campaign_products(campaign_id,product_id,unit_price,display_order,active) VALUES('gongxin','original',85,1,1),('gongxin','matcha',85,2,1),('gongxin','chocolate',85,3,1),('gongxin','prod-e2e-nt1',1,99,1)`].join('; ');
const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)), run=spawnSync(process.execPath,[cli,'d1','execute','kennygcake-group-buy-production','--remote','--config','wrangler.production.toml','--command',sql],{encoding:'utf8',shell:false}); if(run.error||run.status!==0) throw new Error(`Production gongxin seed failed (${run.error?.code??`exit ${run.status}`}); token was not stored`);
new Entry('kennygcake-group-buy-production','gongxin-private-test-token').setPassword(token); console.log('Private gongxin Production test data created; token stored only in Windows Credential Manager.');
