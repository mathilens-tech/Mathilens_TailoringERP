import { apiDelete, apiGet, apiGetPaged, apiPost, apiPut } from "@/lib/api-client";

export const GENDERS = ["Male", "Female"] as const;
export type Gender = (typeof GENDERS)[number];

/** A fixed set rather than free text, because the customers list filters on it. */
export const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist", "Other"] as const;
export type Religion = (typeof RELIGIONS)[number];

export type Customer = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  gender: Gender | null;
  religion: Religion | null;
  /** yyyy-MM-dd — a date with no time, as the API sends it. */
  dateOfBirth: string | null;
  weddingDate: string | null;
  createdAtUtc: string;
};

export type CustomerInput = {
  fullName: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  gender: Gender | null;
  religion: Religion | null;
  dateOfBirth: string | null;
  weddingDate: string | null;
};

export function searchCustomers(
  search: string,
  page: number,
  pageSize: number,
  token: string | null,
  religion: Religion | null = null,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }
  if (religion) {
    params.set("religion", religion);
  }
  return apiGetPaged<Customer>(`/api/v1/customers?${params}`, token);
}

export function getCustomer(id: string, token: string | null) {
  return apiGet<Customer>(`/api/v1/customers/${id}`, token);
}

/** An existing customer who already holds a contact detail being entered. */
export type CustomerDuplicate = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  /** Exact match on the normalized number — almost always the same person written down twice. */
  matchesPhoneNumber: boolean;
  /** Case-insensitive match. Common and often innocent: families share an address. */
  matchesEmail: boolean;
};

/**
 * Customers already holding this phone number or email.
 *
 * <p>Advisory — the server reports, the operator decides. The number is normalized server-side
 * before comparing, so "8220070363" finds the "+918220070363" already on file.</p>
 *
 * @param excludeId the customer being edited, so it isn't reported as its own duplicate.
 */
export function findCustomerDuplicates(
  phoneNumber: string,
  email: string,
  token: string | null,
  excludeId?: string,
) {
  const params = new URLSearchParams();
  if (phoneNumber.trim()) {
    params.set("phone", phoneNumber.trim());
  }
  if (email.trim()) {
    params.set("email", email.trim());
  }
  if (excludeId) {
    params.set("excludeId", excludeId);
  }
  return apiGet<CustomerDuplicate[]>(`/api/v1/customers/duplicates?${params}`, token);
}

export function createCustomer(input: CustomerInput, token: string | null) {
  return apiPost<Customer>("/api/v1/customers", input, token);
}

export function updateCustomer(id: string, input: CustomerInput, token: string | null) {
  return apiPut<Customer>(`/api/v1/customers/${id}`, input, token);
}

export function deleteCustomer(id: string, token: string | null) {
  return apiDelete(`/api/v1/customers/${id}`, token);
}
