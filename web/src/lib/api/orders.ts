import { apiDelete, apiDeleteFor, apiGet, apiGetPaged, apiPost, apiPut } from "@/lib/api-client";
import type { GarmentType } from "./measurements";
import type { ClothUnit } from "./inventory";

/**
 * Mirrors OrderStatus.cs. "Sold" is last because it is not part of the progression before it: a
 * fabric sale is created Sold and stays there, and no tailoring order ever reaches it.
 */
export const ORDER_STATUSES = [
  "Received",
  "InProgress",
  "ReadyForDelivery",
  "Delivered",
  "Cancelled",
  "Sold",
  /** A delivered garment that did not fit, back on the bench. Reached only from Delivered. */
  "Alteration",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FABRIC_SOURCES = ["CustomerSupplied", "ShopSupplied"] as const;
export type FabricSource = (typeof FABRIC_SOURCES)[number];

export type FabricDetails = {
  /** Identifies the cloth so it can be removed from an existing order. */
  id: string;
  fabricType: string;
  source: FabricSource;
  color: string | null;
  quantity: number;
  /** What a metre of this cloth is billed at; zero on cloth recorded before per-metre billing. */
  ratePerMetre: number;
};

export type OrderItem = {
  id: string;
  garmentType: GarmentType;
  quantity: number;
  unitPrice: number;
  /** Every cloth this garment is cut from — empty, one, or several. */
  fabrics: FabricDetails[];
  /** The line's cloth charge — each fabric's length × its rate, summed. */
  clothAmount: number;
  /** What the whole line is worth: stitching × quantity + cloth. */
  lineTotal: number;
};

export type Order = {
  id: string;
  /** The shop's own reference, e.g. "MTL-0001" — what staff and customers call the order. */
  orderNumber: string;
  customerId: string;
  employeeId: string | null;
  status: OrderStatus;
  dueAtUtc: string;
  /** Set only once the order is Delivered. */
  deliveredAtUtc: string | null;
  notes: string | null;
  createdAtUtc: string;
  /** The order's own value — quantity × unit price, before any invoice tax or discount. */
  totalAmount: number;
  /**
   * Collected against this order. Null on responses returned by a write (create, update, status
   * change) — those don't consult billing, so null means "not looked up", not "nothing paid".
   * Always populated when an order is read via search or get-by-id.
   */
  amountPaid: number | null;
  /** totalAmount − amountPaid, and null alongside it. */
  balanceAmount: number | null;
  items: OrderItem[];
  /** Every time this order came back to be altered, oldest first. Empty for almost every order. */
  alterations: OrderAlteration[];
};

export type OrderAlteration = {
  id: string;
  /** What the customer said was wrong — "sleeve too long". */
  reason: string;
  /** Zero for a free rework, which is the usual case. */
  chargeAmount: number;
  /** When the customer had the garment before this alteration; `deliveredAtUtc` moves on after it. */
  previousDeliveredAtUtc: string | null;
  createdAtUtc: string;
};

/**
 * What is still owed on an order, as a figure fit to show somebody.
 *
 * <p><b>Why this exists.</b> `balanceAmount` is `totalAmount − amountPaid`, and those two are
 * measured differently: the order's total is its own pre-tax value, while payments are taken
 * against an <em>invoice</em>, which has tax added on top. Settle an invoice in full and the order
 * reports a negative balance — the tax, paid but not counted in the total it is subtracted from.
 * A counter sale pays its invoice in full the moment it is rung up, so it hits this every time.</p>
 *
 * <p>Clamped at zero rather than shown, because a negative here does not mean what it reads as.
 * "Balance −50.00" says the shop owes the customer money; what happened is that tax was paid on
 * top of the order's own value. Nothing is owed either way, and zero says so.</p>
 *
 * <p>This is a display plaster over a modelling mismatch. The real fix is for the server to
 * measure the balance against the invoice it was paid on. Until then, every screen showing a
 * balance should read it through here so they all tell the same story.</p>
 */
export function outstandingBalance(order: Pick<Order, "balanceAmount">): number | null {
  if (order.balanceAmount === null) {
    return null;
  }

  return Math.max(0, order.balanceAmount);
}

/** `clothCode` is resolved against the price list server-side: a match links this fabric to that
 * cloth so stock falls by `quantity`; anything else is kept as the free text it has always been. */
export type CreateOrderItemFabricInput = {
  fabricType: string;
  source: FabricSource;
  color: string | null;
  quantity: number;
  /** What a metre of this cloth is billed at — lets a garment cut from several cloths price each. */
  ratePerMetre: number;
  clothCode: string | null;
  unit: ClothUnit;
};
export type CreateOrderItemInput = { garmentType: GarmentType; quantity: number; unitPrice: number; fabrics: CreateOrderItemFabricInput[] };
export type CreateOrderInput = {
  customerId: string;
  employeeId: string | null;
  dueAtUtc: string;
  notes: string | null;
  items: CreateOrderItemInput[];
  /**
   * Cloth sold over the counter, with nothing to stitch.
   *
   * The order is recorded as Sold and is finished on the spot — no tailor, no lifecycle, and
   * dueAtUtc read as the moment of sale. Optional so every existing caller keeps taking tailoring
   * orders unchanged.
   */
  isFabricSale?: boolean;
};
export type UpdateOrderInput = { customerId: string; employeeId: string | null; dueAtUtc: string; notes: string | null };

/**
 * @param search Matches the order number, the customer's name or their phone number.
 * @param garmentType Keeps only orders with an item for this garment.
 */
export function searchOrders(
  customerId: string | null,
  status: OrderStatus | null,
  page: number,
  pageSize: number,
  token: string | null,
  search?: string | null,
  garmentType?: string | null,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (customerId) {
    params.set("customerId", customerId);
  }
  if (status) {
    params.set("status", status);
  }
  if (search && search.trim() !== "") {
    params.set("search", search.trim());
  }
  if (garmentType && garmentType.trim() !== "") {
    params.set("garmentType", garmentType.trim());
  }
  return apiGetPaged<Order>(`/api/v1/orders?${params}`, token);
}

/**
 * How many orders have an item for this garment.
 *
 * Asked with a page size of one: the count in the pagination meta is the whole answer, and none of
 * the rows themselves are wanted. Settings › Garments uses it to refuse removing a garment the shop
 * has already booked work against.
 */
export async function countOrdersUsingGarment(garmentType: string, token: string | null): Promise<number> {
  const { meta } = await searchOrders(null, null, 1, 1, token, null, garmentType);
  return meta.totalCount;
}

export function getOrder(id: string, token: string | null) {
  return apiGet<Order>(`/api/v1/orders/${id}`, token);
}

/** This customer's other orders, newest first — matched on their phone number, so a duplicate customer record still shows one history. */
export function getPreviousOrders(id: string, token: string | null) {
  return apiGet<Order[]>(`/api/v1/orders/${id}/previous`, token);
}

export function createOrder(input: CreateOrderInput, token: string | null) {
  return apiPost<Order>("/api/v1/orders", input, token);
}

export function updateOrder(id: string, input: UpdateOrderInput, token: string | null) {
  return apiPut<Order>(`/api/v1/orders/${id}`, input, token);
}

export function deleteOrder(id: string, token: string | null) {
  return apiDelete(`/api/v1/orders/${id}`, token);
}

export function addOrderItem(orderId: string, garmentType: GarmentType, quantity: number, unitPrice: number, token: string | null) {
  return apiPost<Order>(`/api/v1/orders/${orderId}/items`, { garmentType, quantity, unitPrice }, token);
}

export function updateOrderItem(
  orderId: string,
  itemId: string,
  garmentType: GarmentType,
  quantity: number,
  unitPrice: number,
  token: string | null,
) {
  return apiPut<Order>(`/api/v1/orders/${orderId}/items/${itemId}`, { garmentType, quantity, unitPrice }, token);
}

/** Returns the updated order rather than 204 — the totals and remaining items change with it. */
export function removeOrderItem(orderId: string, itemId: string, token: string | null) {
  return apiDeleteFor<Order>(`/api/v1/orders/${orderId}/items/${itemId}`, token);
}

/** Adds one cloth to an item — a garment cut from several cloths calls this once per cloth. */
export function addOrderItemFabric(
  orderId: string,
  itemId: string,
  fabric: { fabricType: string; source: FabricSource; color: string | null; quantity: number; ratePerMetre: number; clothCode: string | null },
  token: string | null,
) {
  return apiPost<Order>(`/api/v1/orders/${orderId}/items/${itemId}/fabrics`, fabric, token);
}

/** Removes one cloth from an item by its id. Returns the updated order — totals move with it. */
export function removeOrderItemFabric(orderId: string, itemId: string, fabricId: string, token: string | null) {
  return apiDeleteFor<Order>(`/api/v1/orders/${orderId}/items/${itemId}/fabrics/${fabricId}`, token);
}

/**
 * Takes a delivered order back for alteration, returning it at status `Alteration` — open again, so
 * the measurements and the cloth can be corrected. `chargeAmount` is zero for a free rework.
 */
export function requestOrderAlteration(orderId: string, reason: string, chargeAmount: number, token: string | null) {
  return apiPost<Order>(`/api/v1/orders/${orderId}/alterations`, { reason, chargeAmount }, token);
}

/** `deliveredAtUtc` is required when targetStatus is "Delivered", and ignored otherwise. */
export function transitionOrderStatus(
  orderId: string,
  targetStatus: OrderStatus,
  token: string | null,
  deliveredAtUtc: string | null = null,
) {
  return apiPut<Order>(`/api/v1/orders/${orderId}/status`, { targetStatus, deliveredAtUtc }, token);
}

export function assignOrderEmployee(orderId: string, employeeId: string, token: string | null) {
  return apiPut<Order>(`/api/v1/orders/${orderId}/employee`, { employeeId }, token);
}
