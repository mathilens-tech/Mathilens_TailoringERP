import { apiPostNoContent } from "@/lib/api-client";

/**
 * Redeems the one-time code an Owner issued, setting the password the user chose.
 *
 * Unauthenticated by necessity — the caller cannot sign in, which is why they have a code. Every
 * way of failing comes back with the same message, so this cannot be used to discover which email
 * addresses have accounts.
 */
export function redeemResetCode(email: string, code: string, newPassword: string) {
  return apiPostNoContent("/api/v1/auth/redeem-reset-code", { email, code, newPassword }, null);
}
