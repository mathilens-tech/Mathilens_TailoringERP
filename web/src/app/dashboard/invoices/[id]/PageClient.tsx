"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge, INVOICE_STATUS_BADGE } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { ApiError } from "@/lib/api-client";
import {
  getInvoice,
  recordPayment,
  voidInvoice,
  paymentMethodLabel,
  PAYMENT_METHODS,
  type Invoice,
  type PaymentMethod,
} from "@/lib/api/billing";
import { getOrder, type Order } from "@/lib/api/orders";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { ShareViaWhatsAppButton } from "@/components/whatsapp/ShareViaWhatsAppButton";
import { useBranding } from "@/lib/use-branding";
import {
  getInvoiceSettings,
  formatInvoiceDate,
  formatInvoiceDateTime,
  DEFAULT_SHOP_NAME,
} from "@/lib/api/invoice-settings";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The shop's own reference. The fallback is what identified an invoice before numbering existed. */
function invoiceNumber(invoice: Invoice) {
  return invoice.invoiceNumber?.trim() || `#${invoice.id.slice(0, 8).toUpperCase()}`;
}

export default function InvoiceDetailPage() {
  const invoiceId = useRouteId();
  const { showToast } = useToast();
  // The shop's name, for the WhatsApp message to greet and sign off with.
  const branding = useBranding();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // For the printed letterhead only. This page used to print "Mathilens Tailoring ERP" — the name
  // of the software — on a document going to a customer of whichever shop is using it.
  const [shopName, setShopName] = useState(DEFAULT_SHOP_NAME);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getInvoice(invoiceId, getAccessToken());
      setInvoice(data);
      // Neither the customer's name/phone nor the order's due date live on the invoice itself
      // (Invoice only stores CustomerId/OrderId) — fetched separately so this page can show them.
      const [orderData, customerData] = await Promise.all([
        getOrder(data.orderId, getAccessToken()),
        getCustomer(data.customerId, getAccessToken()),
      ]);
      setOrder(orderData);
      setCustomer(customerData);

      // Falls back to the shared default if it can't be read — the invoice is still usable, and a
      // failed settings read shouldn't blank a page someone opened to take money on.
      const settings = await getInvoiceSettings(getAccessToken()).catch(() => null);
      if (settings?.companyName.trim()) {
        setShopName(settings.companyName.trim());
      }
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load this invoice.");
    }
  }, [invoiceId]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-mount pattern is intentionally not restructured
    // around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }

    setIsRecordingPayment(true);
    try {
      await recordPayment(invoiceId, amount, paymentMethod, getAccessToken());
      showToast("Payment recorded.");
      setPaymentAmount("");
      await load();
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "Unable to record this payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function handleVoid() {
    setIsVoiding(true);
    try {
      await voidInvoice(invoiceId, getAccessToken());
      showToast("Invoice voided.");
      setConfirmingVoid(false);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to void this invoice.", "error");
    } finally {
      setIsVoiding(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {loadError}
      </p>
    );
  }

  if (!invoice) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  const canRecordPayment = invoice.status !== "Void" && invoice.remainingBalance > 0;
  const canVoid = invoice.amountPaid === 0 && invoice.status !== "Void";

  return (
    <div className="flex flex-col gap-6">
      {/* print:block instead of a permanent header — the app-chrome title above says "Invoice"
          fine on screen, but a printed page needs its own letterhead since the dashboard nav
          (which carries the shop name) is hidden for print.

          The name comes from Invoice Settings. It used to be the string "Mathilens Tailoring ERP"
          written into this file, so every shop using this software printed the software's name on
          documents it handed to its own customers. */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-semibold">{shopName}</h1>
        <p className="text-sm text-foreground/70">
          Invoice {invoiceNumber(invoice)} — printed {formatInvoiceDate(new Date().toISOString())}
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Invoice</h1>
          {/* The reference the customer quotes. It was on the slip and on the list, and missing
              from the one screen dedicated to a single invoice. */}
          <p className="mt-0.5 font-mono text-sm text-primary">{invoiceNumber(invoice)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Beside Print, as 10 asks — the two are the same document going to the same person by
              different routes. Needs the order for its number and collection date, so it waits for
              both to load rather than sharing a message with blanks in it. */}
          {order && customer && (
            <ShareViaWhatsAppButton
              customer={customer}
              invoice={invoice}
              order={{ orderNumber: order.orderNumber, dueAtUtc: order.dueAtUtc }}
              shopName={branding.shopName || "Mathilens"}
              whatsAppApp={branding.whatsAppApp}
            />
          )}
          <button type="button" onClick={() => window.print()} className="text-sm text-foreground/70 hover:text-foreground">
            Print
          </button>
          <Link href="/dashboard/invoices" className="text-sm text-foreground/70 hover:text-foreground">
            Back to invoices
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6 print:border-0 print:p-0">
        {/* Who and when, then what it comes to — two groups rather than ten equal cells, because
            "whose invoice is this" and "how much is left" are different questions. */}
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-foreground/70">Customer</dt>
            <dd className="font-medium">{customer ? customer.fullName : "—"}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Phone number</dt>
            <dd className="font-medium">{customer ? customer.phoneNumber : "—"}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Order</dt>
            {/* The invoice knew its order and gave no way to reach it — you could see that it
                billed something without seeing what. */}
            <dd className="font-medium">
              {order ? (
                <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-primary hover:underline print:text-foreground">
                  {order.orderNumber?.trim() || `#${order.id.slice(0, 8).toUpperCase()}`}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/70">Invoice date</dt>
            <dd className="font-medium">{formatInvoiceDate(invoice.createdAtUtc)}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Collection date</dt>
            {/* dd/MM/yyyy like every other date in the app. toLocaleDateString followed the
                browser's locale, so one counter read 19/08/2026 and another 8/19/2026. */}
            <dd className="font-medium">{order ? formatInvoiceDate(order.dueAtUtc) : "—"}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Status</dt>
            <dd className="mt-0.5">
              <StatusBadge {...INVOICE_STATUS_BADGE[invoice.status]} />
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-foreground/70">Subtotal</dt>
            <dd className="font-medium tabular-nums">{invoice.subtotal.toFixed(2)}</dd>
          </div>
          <div>
            {/* Zeroes stay on this screen where they are hidden on the slip: paper costs a line,
                and the shop's own record should say outright that no tax was charged. */}
            <dt className="text-foreground/70">Tax</dt>
            <dd className="font-medium tabular-nums">{invoice.taxAmount.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Discount</dt>
            <dd className="font-medium tabular-nums">{invoice.discountAmount.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Total</dt>
            <dd className="font-medium tabular-nums">{invoice.totalAmount.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Advance / Paid</dt>
            <dd className="font-medium tabular-nums">{invoice.amountPaid.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">Balance</dt>
            {/* Outstanding money carries colour here the same way it does in every list. */}
            <dd
              className={
                invoice.remainingBalance > 0 ? "font-medium tabular-nums text-danger" : "font-medium tabular-nums"
              }
            >
              {invoice.remainingBalance.toFixed(2)}
            </dd>
          </div>
        </dl>

        {canVoid && (
          <div className="print:hidden">
            <Button type="button" variant="danger" onClick={() => setConfirmingVoid(true)}>
              Void Invoice
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 print:border-0 print:p-0">
        <h2 className="mb-3 text-lg font-semibold">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-foreground/70">No payments recorded yet.</p>
        ) : (
          // Fixed columns rather than justify-between, so the amounts sit in a line down the list
          // instead of drifting with the length of the method beside them.
          <ul className="flex flex-col gap-2">
            {invoice.payments.map((payment) => (
              <li
                key={payment.id}
                className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{paymentMethodLabel(payment.method)}</span>
                <span className="text-right font-medium tabular-nums">{payment.amount.toFixed(2)}</span>
                <span className="w-32 text-right text-foreground/70">{formatInvoiceDateTime(payment.createdAtUtc)}</span>
              </li>
            ))}
          </ul>
        )}

        {canRecordPayment && (
          <form onSubmit={handleRecordPayment} className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-surface p-4 print:hidden">
            <span className="text-sm font-medium">Record a payment</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`Amount (balance: ${invoice.remainingBalance.toFixed(2)})`}
                className={fieldClassName}
              />
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={fieldClassName}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabel(method)}
                  </option>
                ))}
              </select>
            </div>
            {paymentError && (
              <p role="alert" className="text-sm text-danger">
                {paymentError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={isRecordingPayment}>
                {isRecordingPayment ? "Recording…" : "Record payment"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={confirmingVoid}
        title="Void invoice"
        description="Are you sure you want to void this invoice? This cannot be undone."
        confirmLabel="Void"
        isConfirming={isVoiding}
        onConfirm={handleVoid}
        onCancel={() => setConfirmingVoid(false)}
      />
    </div>
  );
}
