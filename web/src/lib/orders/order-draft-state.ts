import type { ItemRow } from "@/components/orders/OrderItemsEditor";
import type { OrderKind } from "@/lib/orders/order-kind";
import type { PaymentMethod } from "@/lib/api/billing";

/**
 * The part of the New Order form worth keeping when somebody walks away.
 *
 * <p>Everything here is something a person typed or chose. Deliberately absent: the garment list,
 * the price list, the fabric catalogue, the customer search results and the measurement panel's
 * contents. The first four are shop data that will be re-fetched on resume and would only go stale
 * in a draft; the last is already saved — the measurement panel writes to the customer's record the
 * moment its Save is pressed, so measurements survive whether or not a draft does.</p>
 *
 * <p>Versioned because this is stored JSON that outlives the code that wrote it. A draft saved
 * before a field existed is read back by a later build, and `version` is what lets that build know
 * what it is looking at rather than inferring from which properties happen to be missing.</p>
 */
export type OrderDraftState = {
  version: 1;
  kind: OrderKind;
  customerId: string | null;
  /** Kept so the resumed form can show who it is for before the customer record has loaded. */
  customerName: string | null;
  employeeId: string | null;
  dueAtUtc: string;
  orderNotes: string;
  itemRows: ItemRow[];
  advanceAmount: string;
  advanceMethod: PaymentMethod;
  discountAmount: string;
};

/**
 * Whether a draft is worth storing at all.
 *
 * <p>Only three things count, and all three are figures a person typed: a cloth code, a length of
 * cloth, or a measurement. Everything else on the screen arrives without anybody acting.</p>
 *
 * <p>This is stricter than it first was, because the first version filled the Resume list with
 * drafts nobody had started. It counted a filled <c>tailoringRate</c> as work — but the editor's
 * settling effect writes that from the shop's price list the moment the garment list loads, so
 * every row was "filled in" before the screen had even been looked at. <c>ratePerMetre</c> has the
 * same fault: picking a cloth code fills it, so it can never be the thing that proves anything on
 * its own. Quantity starts at "1" on every new row and proves nothing either.</p>
 *
 * <p>Choosing a customer no longer counts on its own. Opening New Order and picking who it is for
 * is where an order begins, not where it becomes worth recovering — and someone who gets that far
 * and stops has lost one search, not any work.</p>
 */
export function isWorthSaving(state: OrderDraftState, hasMeasurementInput: boolean): boolean {
  if (hasMeasurementInput) {
    return true;
  }

  return state.itemRows.some((row) => row.clothCode.trim() !== "" || row.metres.trim() !== "");
}

/** The one line the Resume list shows, so a draft can be told apart without opening it. */
export function summarize(state: OrderDraftState, kindLabel: string): string {
  const who = state.customerName?.trim() || "No customer yet";
  const garments = state.itemRows
    .map((row) => row.garmentType)
    .filter((name, index, all) => name && all.indexOf(name) === index);

  const what = garments.length === 0 ? "no items" : garments.join(", ");
  return `${who} — ${kindLabel} — ${what}`;
}

/**
 * Reads stored JSON back into form state, or null if it cannot be trusted.
 *
 * <p>Returns null rather than throwing, and rather than half-applying. A draft written by a much
 * older build, or hand-edited in the database, should leave the form empty and the draft skippable
 * — restoring half of one would produce an order that looks complete and is not.</p>
 */
export function parseDraft(payload: string): OrderDraftState | null {
  try {
    const parsed = JSON.parse(payload) as Partial<OrderDraftState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.itemRows)) {
      return null;
    }
    return parsed as OrderDraftState;
  } catch {
    return null;
  }
}
