import { ApiError } from "./http";
import { linePay } from "./line-pay";
import type { Env } from "./types";

type Attempt = { id:string; order_id:string; status:string; provider_transaction_id:string|null; requested_amount:number; expires_at:string|null };
const now = () => new Date().toISOString();
const safeId = (v:string) => { if (!/^[A-Za-z0-9_-]{8,80}$/.test(v)) throw new ApiError(404,"PAYMENT_NOT_FOUND","Payment was not found"); return v; };
async function attempt(env:Env,id:string) { return env.DB.prepare("SELECT id, order_id, status, provider_transaction_id, requested_amount, expires_at FROM payment_attempts WHERE id=?1").bind(safeId(id)).first<Attempt>(); }
async function event(env:Env,a:string,type:string,code:string,key:string) { await env.DB.prepare("INSERT OR IGNORE INTO payment_events(id,payment_attempt_id,event_type,provider_return_code,idempotency_key,created_at) VALUES(?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),a,type,code,key,now()).run(); }

export async function requestPayment(request:Request,env:Env,orderId:string,campaignId:string) {
  const enabled = new Set((env.PAYMENT_ENABLED_CAMPAIGNS || "").split(",").map(v => v.trim()).filter(Boolean));
  if (!enabled.has(campaignId)) throw new ApiError(403,"PAYMENT_NOT_ENABLED","Payment is not enabled for this campaign");
  const key=request.headers.get("Idempotency-Key"); if(!key||!/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw new ApiError(400,"IDEMPOTENCY_KEY_REQUIRED","A valid Idempotency-Key is required");
  const order=await env.DB.prepare("SELECT id,total_amount,payment_status FROM orders WHERE id=?1 AND campaign_id=?2").bind(orderId,campaignId).first<{id:string;total_amount:number;payment_status:string}>();
  if(!order) throw new ApiError(404,"ORDER_NOT_FOUND","Order was not found"); if(order.payment_status==="PAID") throw new ApiError(409,"ORDER_ALREADY_PAID","Order is already paid");
  const existing=await env.DB.prepare("SELECT id,status,payment_url_web,provider_transaction_id FROM payment_attempts WHERE request_idempotency_key=?1").bind(key).first<any>(); if(existing) return existing;
  await env.DB.prepare("UPDATE payment_attempts SET status='EXPIRED',updated_at=?1 WHERE order_id=?2 AND status IN ('CREATED','REQUESTED','AUTHORIZED') AND expires_at<=?1").bind(now(),order.id).run();
  const active=await env.DB.prepare("SELECT id,status,payment_url_web,provider_transaction_id FROM payment_attempts WHERE order_id=?1 AND status IN ('CREATED','REQUESTED','AUTHORIZED')").bind(order.id).first<any>(); if(active) return active;
  const id=`PAY-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`, created=now(), expires=new Date(Date.now()+20*60_000).toISOString();
  await env.DB.prepare("INSERT INTO payment_attempts(id,order_id,status,requested_amount,request_idempotency_key,created_at,updated_at,expires_at) VALUES(?1,?2,'CREATED',?3,?4,?5,?5,?6)").bind(id,order.id,order.total_amount,key,created,expires).run();
  const base=env.PUBLIC_API_BASE_URL.replace(/\/$/,"");
  const result=await linePay(env,"POST","/v3/payments/request",{amount:order.total_amount,currency:"TWD",orderId:`${order.id}-${id}`,packages:[{id,amount:order.total_amount,name:"KennyGCake 企業團購",products:[{name:"KennyGCake 企業團購訂單",quantity:1,price:order.total_amount}]}],redirectUrls:{confirmUrl:`${base}/v1/payments/${id}/confirm`,cancelUrl:`${base}/v1/payments/${id}/cancel`}});
  if(result.returnCode!=="0000") { await env.DB.prepare("UPDATE payment_attempts SET status='FAILED',provider_return_code=?1,failure_reason=?2,updated_at=?3 WHERE id=?4").bind(result.returnCode,result.returnMessage,now(),id).run(); throw new ApiError(502,"LINE_PAY_REQUEST_FAILED","LINE Pay payment request failed"); }
  const tx=String(result.info?.transactionId??""), url=String(result.info?.paymentUrl?.web??"");
  await env.DB.prepare("UPDATE payment_attempts SET status='REQUESTED',provider_transaction_id=?1,payment_url_web=?2,provider_return_code='0000',updated_at=?3 WHERE id=?4").bind(tx,url,now(),id).run(); await event(env,id,"REQUESTED","0000",`request:${tx}`);
  return {id,status:"REQUESTED",paymentUrl:url,transactionId:tx,expiresAt:expires};
}

export async function confirmPayment(env:Env,id:string,transactionId:string|null) {
  const a=await attempt(env,id); if(!a||!a.provider_transaction_id||transactionId!==a.provider_transaction_id) throw new ApiError(404,"PAYMENT_NOT_FOUND","Payment was not found");
  if(a.status==="CONFIRMED") return {status:"CONFIRMED",orderId:a.order_id}; if(a.expires_at&&Date.parse(a.expires_at)<=Date.now()) { await env.DB.prepare("UPDATE payment_attempts SET status='EXPIRED',updated_at=?1 WHERE id=?2").bind(now(),id).run(); throw new ApiError(409,"PAYMENT_EXPIRED","Payment attempt expired"); }
  const r=await linePay(env,"POST",`/v3/payments/${a.provider_transaction_id}/confirm`,{amount:a.requested_amount,currency:"TWD"}); await event(env,id,"CONFIRM_CALLBACK",r.returnCode,`confirm:${a.provider_transaction_id}:${r.returnCode}`);
  if(r.returnCode!=="0000") throw new ApiError(409,"LINE_PAY_CONFIRM_FAILED","Payment was not confirmed");
  await env.DB.batch([env.DB.prepare("UPDATE payment_attempts SET status='CONFIRMED',confirmed_at=?1,updated_at=?1 WHERE id=?2 AND status!='CONFIRMED'").bind(now(),id),env.DB.prepare("UPDATE orders SET payment_status='PAID',paid_at=?1,updated_at=?1 WHERE id=?2 AND payment_status!='PAID'").bind(now(),a.order_id)]); return {status:"CONFIRMED",orderId:a.order_id};
}

export async function cancelPayment(env:Env,id:string) { const a=await attempt(env,id); if(!a) throw new ApiError(404,"PAYMENT_NOT_FOUND","Payment was not found"); if(a.status==="CONFIRMED") throw new ApiError(409,"PAYMENT_ALREADY_CONFIRMED","Confirmed payment cannot be cancelled here"); await env.DB.batch([env.DB.prepare("UPDATE payment_attempts SET status='CANCELLED',updated_at=?1 WHERE id=?2").bind(now(),id),env.DB.prepare("UPDATE orders SET payment_status='CANCELLED',updated_at=?1 WHERE id=?2 AND payment_status!='PAID'").bind(now(),a.order_id)]); await event(env,id,"CANCEL_CALLBACK","USER_CANCELLED",`cancel:${id}`); return {status:"CANCELLED",orderId:a.order_id}; }
export async function paymentStatus(env:Env,id:string) {
  let a=await attempt(env,id); if(!a) throw new ApiError(404,"PAYMENT_NOT_FOUND","Payment was not found");
  if(a.status==="REQUESTED"&&a.expires_at&&Date.parse(a.expires_at)<=Date.now()) await env.DB.prepare("UPDATE payment_attempts SET status='EXPIRED',updated_at=?1 WHERE id=?2").bind(now(),id).run();
  else if(["REQUESTED","AUTHORIZED"].includes(a.status)&&a.provider_transaction_id) {
    const r=await linePay(env,"GET",`/v3/payments/requests/${a.provider_transaction_id}/check`);
    const mapped:Record<string,string>={"0110":"AUTHORIZED","0121":"CANCELLED","0122":"FAILED","0123":"CONFIRMED"}; const status=mapped[r.returnCode];
    await event(env,id,"STATUS_CHECK",r.returnCode,`status:${a.provider_transaction_id}:${r.returnCode}`);
    if(status) { await env.DB.prepare("UPDATE payment_attempts SET status=?1,provider_return_code=?2,updated_at=?3 WHERE id=?4").bind(status,r.returnCode,now(),id).run(); if(status==="CONFIRMED") await env.DB.prepare("UPDATE orders SET payment_status='PAID',paid_at=?1,updated_at=?1 WHERE id=?2 AND payment_status!='PAID'").bind(now(),a.order_id).run(); }
  }
  a=await attempt(env,id); return {id:a?.id,orderId:a?.order_id,status:a?.status,transactionId:a?.provider_transaction_id,expiresAt:a?.expires_at};
}
