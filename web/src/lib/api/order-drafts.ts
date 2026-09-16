import { apiDelete, apiGet, apiPut } from "@/lib/api-client";
import type { OrderKind } from "@/lib/orders/order-kind";

/**
 * An order somebody started writing and has not finished.
 *
 * <p>The server stores `payload` as opaque JSON and never looks inside it — see OrderDraft on the
 * domain side. That is what lets the New Order screen change shape without a migration, and it is
 * also why the shape below is defined here, beside the screen that writes it, rather than being
 * mirrored from a server contract that does not exist.</p>
 */
export type OrderDraftSummary = {
  id: string;
  kind: OrderKind;
  customerId: string | null;
  /** One line naming the draft, so the list reads without opening anything. */
  summary: string;
  createdAtUtc: string;
  lastModifiedAtUtc: string | null;
};

export type OrderDraft = OrderDraftSummary & {
  payload: string;
};

export function listOrderDrafts(token: string | null) {
  return apiGet<OrderDraftSummary[]>("/api/v1/order-drafts", token);
}

export function getOrderDraft(id: string, token: string | null) {
  return apiGet<OrderDraft>(`/api/v1/order-drafts/${id}`, token);
}

/**
 * Creates a draft, or replaces the one named by `id`.
 *
 * <p>A PUT with the id in the body rather than the path: autosave does not know whether it is
 * creating or updating, because it only learns the id from the first save's response.</p>
 */
export function saveOrderDraft(
  input: {
    id: string | null;
    kind: OrderKind;
    customerId: string | null;
    summary: string;
    payload: string;
  },
  token: string | null,
) {
  return apiPut<OrderDraft>("/api/v1/order-drafts", input, token);
}

export function deleteOrderDraft(id: string, token: string | null) {
  return apiDelete(`/api/v1/order-drafts/${id}`, token);
}
