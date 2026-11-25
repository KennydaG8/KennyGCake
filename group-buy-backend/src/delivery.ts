import { ApiError } from "./http";
import type { CreateOrderBody } from "./types";
import { text } from "./validation";

// Keep in step with LEAD_WORKDAYS and DEFAULT_SLOTS in order/order.js.
export const LEAD_WORKDAYS = 3;
export const DELIVERY_SLOTS = ["10:00–12:00", "12:00–14:00", "14:00–17:00"];
const MAX_DAYS_AHEAD = 180;
const DAY = 86_400_000;

export interface Delivery { email: string | null; date: string; slot: string; address: string }

// Calendar days are handled as UTC midnights of the Taipei date.
function taipeiToday(now: Date): number {
  const local = new Date(now.getTime() + 8 * 3_600_000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}
const isWeekend = (day: number) => [0, 6].includes(new Date(day).getUTCDay());

export function earliestDelivery(now: Date): number {
  let day = taipeiToday(now);
  for (let added = 0; added < LEAD_WORKDAYS;) { day += DAY; if (!isWeekend(day)) added++; }
  return day;
}

export function validateDelivery(body: CreateOrderBody, now: Date): Delivery {
  const date = text(body.deliveryDate, "deliveryDate", true, 10)!;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) throw new ApiError(422, "INVALID_DELIVERY_DATE", "Invalid delivery date");
  if (isWeekend(day) || day < earliestDelivery(now) || day > taipeiToday(now) + MAX_DAYS_AHEAD * DAY) throw new ApiError(422, "INVALID_DELIVERY_DATE", "Delivery date is not available");
  const slot = text(body.deliverySlot, "deliverySlot", true, 20)!;
  if (!DELIVERY_SLOTS.includes(slot)) throw new ApiError(422, "INVALID_DELIVERY_SLOT", "Delivery slot is not available");
  return { email: text(body.email, "email", false, 120), date, slot, address: text(body.deliveryAddress, "deliveryAddress", true, 120)! };
}
