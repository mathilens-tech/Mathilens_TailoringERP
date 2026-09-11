import { apiDelete, apiGet, apiGetPaged, apiPost, apiPut } from "@/lib/api-client";

export type ClothPrice = {
  id: string;
  clothCode: string;
  clothName: string;
  costPrice: number;
  sellingPrice: number;
  createdAtUtc: string;
};

export type ClothPriceInput = {
  clothCode: string;
  clothName: string;
  costPrice: number;
  sellingPrice: number;
};

export function searchClothPrices(search: string, page: number, pageSize: number, token: string | null) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }
  return apiGetPaged<ClothPrice>(`/api/v1/cloth-prices?${params}`, token);
}

/**
 * Every cloth code, for screens that show the catalogue as a dropdown rather than a search box.
 *
 * Gathered page by page because the API caps a page at 100 (PaginationDefaults.MaxPageSize) —
 * asking for one big page would silently show only the first hundred codes, and a dropdown that
 * quietly omits stock is worse than one that takes an extra moment to fill. The page cap bounds
 * this at 2000 codes; a shop that outgrows a dropdown has outgrown it in the UI too, so that
 * ceiling is a signal rather than a limit to raise.
 */
export async function listAllClothPrices(token: string | null): Promise<ClothPrice[]> {
  const pageSize = 100;
  const maxPages = 20;
  const all: ClothPrice[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const { items } = await searchClothPrices("", page, pageSize, token);
    all.push(...items);
    if (items.length < pageSize) {
      break;
    }
  }

  return all.sort((a, b) => a.clothCode.localeCompare(b.clothCode));
}

export function getClothPrice(id: string, token: string | null) {
  return apiGet<ClothPrice>(`/api/v1/cloth-prices/${id}`, token);
}

export function createClothPrice(input: ClothPriceInput, token: string | null) {
  return apiPost<ClothPrice>("/api/v1/cloth-prices", input, token);
}

export function updateClothPrice(id: string, input: ClothPriceInput, token: string | null) {
  return apiPut<ClothPrice>(`/api/v1/cloth-prices/${id}`, input, token);
}

export function deleteClothPrice(id: string, token: string | null) {
  return apiDelete(`/api/v1/cloth-prices/${id}`, token);
}
