import { ApiError } from "./http";
import type { CreateOrderBody, RequestedItem } from "./types";

const text = (value: unknown, field: string, required: boolean, max: number): string | null => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(422, "INVALID_ORDER", `${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new ApiError(422, "INVALID_ORDER", `${field} must be text`);
  const normalized = value.trim();
  if (!normalized && required) throw new ApiError(422, "INVALID_ORDER", `${field} is required`);
  if (normalized.length > max) throw new ApiError(422, "INVALID_ORDER", `${field} is too long`);
  return normalized || null;
};

export function validateOrderBody(body: CreateOrderBody) {
  const rawBody = body as Record<string, unknown>;
  if (Object.hasOwn(rawBody, "totalAmount") || Object.hasOwn(rawBody, "unitPrice") || Object.hasOwn(rawBody, "subtotal")) throw new ApiError(422, "CLIENT_PRICE_REJECTED", "Client-supplied prices are not accepted");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) throw new ApiError(422, "INVALID_ORDER", "At least one item is required");
  const seen = new Set<string>();
  const items: RequestedItem[] = body.items.map((value) => {
    if (!value || typeof value !== "object") throw new ApiError(422, "INVALID_ORDER", "Invalid item");
    const raw = value as Record<string, unknown>;
    if (Object.hasOwn(raw, "unitPrice") || Object.hasOwn(raw, "subtotal") || Object.hasOwn(raw, "totalAmount")) throw new ApiError(422, "CLIENT_PRICE_REJECTED", "Client-supplied prices are not accepted");
    if (typeof raw.productId !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(raw.productId)) throw new ApiError(422, "INVALID_ORDER", "Invalid productId");
    if (!Number.isSafeInteger(raw.quantity) || Number(raw.quantity) < 1 || Number(raw.quantity) > 99) throw new ApiError(422, "INVALID_ORDER", "Quantity must be between 1 and 99");
    if (seen.has(raw.productId)) throw new ApiError(422, "INVALID_ORDER", "Duplicate productId");
    seen.add(raw.productId);
    return { productId: raw.productId, quantity: Number(raw.quantity) };
  });
  const phone = text(body.phone, "phone", true, 20)!;
  const compactPhone = phone.replace(/[\s-]/g, "");
  const normalizedPhone = /^09\d{8}$/.test(compactPhone)
    ? compactPhone
    : /^\+8869\d{8}$/.test(compactPhone)
      ? `0${compactPhone.slice(4)}`
      : null;
  if (!normalizedPhone) throw new ApiError(422, "INVALID_ORDER", "Invalid Taiwan mobile number");
  return {
    customerName: text(body.customerName, "customerName", true, 50)!,
    phone: normalizedPhone,
    lineName: text(body.lineName, "lineName", false, 80),
    department: text(body.department, "department", false, 80),
    note: text(body.note, "note", false, 300),
    gamePasscode: text(body.gamePasscode, "gamePasscode", false, 12),
    items,
  };
}
