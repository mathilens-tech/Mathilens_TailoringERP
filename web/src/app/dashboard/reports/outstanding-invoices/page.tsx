"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { StatusBadge, INVOICE_STATUS_BADGE } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { getOutstandingInvoicesReport, type OutstandingInvoice } from "@/lib/api/reports";

/**
 * Invoices with money still owed.
 *
 * No date range here, unlike its siblings: an unpaid invoice matters whenever it was raised, and a
 * range would quietly hide the oldest debts — the ones most worth chasing.
 */
export default function OutstandingInvoicesReportPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items, meta } = await getOutstandingInvoicesReport(page, pageSize, getAccessToken());
      setInvoices(items);
      setMeta(meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load outstanding invoices.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoice</h1>
          <p className="mt-1 text-sm text-foreground/70">Every invoice with a balance still to collect, oldest first.</p>
        </div>
        {/* No range to pass — this report deliberately has none. */}
        <ExportButton resource="reports" label="outstanding invoices" query={{ report: "outstanding-invoices" }} />
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-foreground/70">No outstanding invoices.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-0">
                  <td data-label="Status" className="px-4 py-3">
                    <StatusBadge {...(INVOICE_STATUS_BADGE[invoice.status] ?? { label: invoice.status, tone: "neutral" })} />
                  </td>
                  <td data-label="Total" className="px-4 py-3">{invoice.totalAmount.toFixed(2)}</td>
                  <td data-label="Paid" className="px-4 py-3">{invoice.amountPaid.toFixed(2)}</td>
                  <td data-label="Balance" className="px-4 py-3">{invoice.remainingBalance.toFixed(2)}</td>
                  <td data-label="Created" className="px-4 py-3">{new Date(invoice.createdAtUtc).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
