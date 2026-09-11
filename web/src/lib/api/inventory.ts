import { apiGetPaged, apiPost } from "@/lib/api-client";

export const CLOTH_UNITS = ["Metres", "Yards", "Pieces", "Rolls"] as const;
export type ClothUnit = (typeof CLOTH_UNITS)[number];

export type ClothReceipt = {
  id: string;
  clothPriceId: string;
  clothCode: string;
  clothName: string;
  quantity: number;
  unit: ClothUnit;
  /** yyyy-MM-dd */
  receivedOn: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  ratePerUnit: number | null;
  /** Quantity × rate, computed server-side; null when no rate was recorded. */
  totalCost: number | null;
  notes: string | null;
  createdAtUtc: string;
};

export type ReceiveClothInput = {
  clothPriceId: string;
  quantity: number;
  unit: ClothUnit;
  receivedOn: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  ratePerUnit: number | null;
  notes: string | null;
};

export type ClothReceiptFilters = {
  search: string;
  from: string;
  to: string;
};

export function searchClothReceipts(
  filters: ClothReceiptFilters,
  page: number,
  pageSize: number,
  token: string | null,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  return apiGetPaged<ClothReceipt>(`/api/v1/inventory/cloth-receipts?${params}`, token);
}

export function receiveCloth(input: ReceiveClothInput, token: string | null) {
  return apiPost<ClothReceipt>("/api/v1/inventory/cloth-receipts", input, token);
}

/** Split by unit — metres and rolls are both real and cannot be added together. `available` can
 * go negative when cloth was issued against a code, or in a unit, nothing was received under. */
export type StockQuantity = { unit: ClothUnit; received: number; used: number; available: number };

export type StockSummary = {
  clothPriceId: string;
  clothCode: string;
  clothName: string;
  quantities: StockQuantity[];
  /** yyyy-MM-dd of the most recent delivery. Null when only consumption has been recorded. */
  lastReceivedOn: string | null;
};

export function getStockSummary(search: string, page: number, pageSize: number, token: string | null) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }
  return apiGetPaged<StockSummary>(`/api/v1/inventory/stock?${params}`, token);
}
