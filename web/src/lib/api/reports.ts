import { apiGet, apiGetPaged } from "@/lib/api-client";
import type { OrderStatus } from "./orders";
import type { InvoiceStatus } from "./billing";

export type RevenueReport = {
  fromUtc: string;
  toUtc: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
};

/**
 * The money position on orders *booked* in the range — order value, not invoiced value, so work
 * that was never billed counts too. Carries no cost data, so it says nothing about profit.
 */
export type OrderCollectionsReport = {
  fromUtc: string;
  toUtc: string;
  orderCount: number;
  orderValue: number;
  deliveredValue: number;
  collectedAmount: number;
  pendingAmount: number;
  cancelledValue: number;
  discountsGiven: number;
};

export type OrderStatusCount = {
  status: OrderStatus;
  count: number;
};

export type OrderStatusSummaryReport = {
  fromUtc: string;
  toUtc: string;
  statusCounts: OrderStatusCount[];
};

export type OutstandingInvoice = {
  id: string;
  customerId: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  status: InvoiceStatus;
  createdAtUtc: string;
};

export function getRevenueReport(fromUtc: string, toUtc: string, token: string | null) {
  const params = new URLSearchParams({ fromUtc, toUtc });
  return apiGet<RevenueReport>(`/api/v1/reports/revenue?${params}`, token);
}

export function getOrderCollectionsReport(fromUtc: string, toUtc: string, token: string | null) {
  const params = new URLSearchParams({ fromUtc, toUtc });
  return apiGet<OrderCollectionsReport>(`/api/v1/reports/order-collections?${params}`, token);
}

export function getOrderStatusSummaryReport(fromUtc: string, toUtc: string, token: string | null) {
  const params = new URLSearchParams({ fromUtc, toUtc });
  return apiGet<OrderStatusSummaryReport>(`/api/v1/reports/order-status-summary?${params}`, token);
}

export function getOutstandingInvoicesReport(page: number, pageSize: number, token: string | null) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiGetPaged<OutstandingInvoice>(`/api/v1/reports/outstanding-invoices?${params}`, token);
}
