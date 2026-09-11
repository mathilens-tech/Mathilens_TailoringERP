"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SearchPicker } from "@/components/ui/SearchPicker";
import { StatusBadge, ORDER_STATUS_BADGE, INVOICE_STATUS_BADGE, orderStatusLabel } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";
import { InvoicePrintModal } from "@/components/orders/InvoicePrintModal";
import { ShareViaWhatsAppButton } from "@/components/whatsapp/ShareViaWhatsAppButton";
import type { ShareKind } from "@/lib/whatsapp/whatsapp-service";
import { useBranding } from "@/lib/use-branding";
import { OrderWorkflow } from "./OrderWorkflow";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { ApiError } from "@/lib/api-client";
import { getEmployee, searchEmployees, type Employee } from "@/lib/api/employees";
import { getCustomer, searchCustomers, type Customer } from "@/lib/api/customers";
import { createInvoice, recordPayment, type Invoice } from "@/lib/api/billing";
import { findInvoicesForOrder, activeInvoiceOf, deliveryFactsFor } from "@/lib/api/order-invoices";
import { DeliveryDialog, type DeliveryPayment } from "@/components/orders/DeliveryDialog";
import { getInvoiceSettings, taxAmountFor, DEFAULT_INVOICE_SETTINGS } from "@/lib/api/invoice-settings";
import { DateInput } from "@/components/ui/DateInput";
import {
  getOrder,
  getPreviousOrders,
  updateOrder,
  transitionOrderStatus,
  assignOrderEmployee,
  type Order,
  type OrderStatus,
} from "@/lib/api/orders";

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  Received: ["InProgress", "Cancelled"],
  InProgress: ["ReadyForDelivery", "Cancelled"],
  ReadyForDelivery: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
  // Cloth already across the counter. Terminal on arrival, so the page offers no next step at all.
  Sold: [],
};

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The largest page the API will accept — PaginationDefaults.MaxPageSize. Asking for more is a 400. */
const MAX_PAGE_SIZE = 100;

/** A shop with more staff than this is not choosing from a dropdown anyway. */
const EMPLOYEE_PAGE_LIMIT = 5;

export default function OrderDetailPage() {
  const orderId = useRouteId();
  const { showToast } = useToast();
  // The shop's name, for the WhatsApp message to greet and sign off with.
  const branding = useBranding();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [assignedEmployee, setAssignedEmployee] = useState<Employee | null>(null);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // The assign-employee step in the workflow. Its own dialog rather than the picker further down,
  // because at this point the question is "who takes this?" and the answer should be a list to
  // choose from, not a box to type a name into that the reader may not remember.
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignOptions, setAssignOptions] = useState<Employee[]>([]);
  const [assignChoice, setAssignChoice] = useState("");
  const [isLoadingAssignOptions, setIsLoadingAssignOptions] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editDueAt, setEditDueAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // null while the lookup is still running, so the card can say "checking" rather than flash
  // "no invoice yet" at an order that has one.
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  // The shop-wide tax rate, so the confirm can state the figure the invoice will actually carry.
  const [taxRatePercent, setTaxRatePercent] = useState(DEFAULT_INVOICE_SETTINGS.taxRatePercent);
  const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = getAccessToken();
      const data = await getOrder(orderId, token);
      setOrder(data);
      // A missing customer shouldn't blank the whole page — the order is still workable.
      setCustomer(await getCustomer(data.customerId, token).catch(() => null));
      // Named on the details card so staff can see who holds the order, not merely that someone does.
      setAssignedEmployee(data.employeeId ? await getEmployee(data.employeeId, token).catch(() => null) : null);
      // Same reasoning for the history panel: it's context, not something to fail the page over.
      setPreviousOrders(await getPreviousOrders(orderId, token).catch(() => []));
      // Empty on failure, which reads as "no invoice" and offers to generate one. Wrong in the
      // rare case the lookup itself broke, but the alternative — hiding the action — leaves staff
      // with no way to invoice the order at all.
      setInvoices(await findInvoicesForOrder(orderId, data.customerId, token).catch(() => []));
      // Falls back to no tax if the setting can't be read — better to under-charge and correct it
      // than to put a figure on a customer's invoice that nobody chose.
      setTaxRatePercent((await getInvoiceSettings(token).catch(() => DEFAULT_INVOICE_SETTINGS)).taxRatePercent);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load this order.");
    }
  }, [orderId]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-mount pattern is intentionally not restructured
    // around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleTransition(target: OrderStatus, deliveredAtUtc: string | null = null) {
    setIsTransitioning(true);
    try {
      await transitionOrderStatus(orderId, target, getAccessToken(), deliveredAtUtc);
      showToast(`Order marked ${target}.`);
      setIsConfirmingDelivery(false);
      await load();
    } catch (error) {
      // The server refuses delivery while an invoice for this order still has a balance —
      // its message names the outstanding amount, so surface it as-is.
      showToast(error instanceof ApiError ? error.message : "Unable to update the order status.", "error");
    } finally {
      setIsTransitioning(false);
    }
  }

  /** Delivery collects a date and any balance owed, so it goes through a dialog rather than straight to the API. */
  function startTransition(target: OrderStatus) {
    if (target !== "Delivered") {
      handleTransition(target);
      return;
    }

    setDeliveryError(null);
    setIsConfirmingDelivery(true);
  }

  /**
   * The money, then the handover — the server refuses delivery while anything is outstanding, so
   * the payment has to land first. A transition that then fails leaves the payment recorded, which
   * is right: the shop did take it.
   */
  async function handleDeliver(deliveredAtUtc: string, payment: DeliveryPayment | null) {
    setDeliveryError(null);
    setIsTransitioning(true);

    try {
      const token = getAccessToken();

      if (payment) {
        // Raised first when there is nothing to pay against — an order can reach Ready for Delivery
        // without ever being invoiced, and money cannot be recorded against thin air.
        const facts = deliveryFactsFor(order, invoices ?? [], taxRatePercent);
        const invoice =
          facts.payable ??
          (await createInvoice(orderId, taxAmountFor(order?.totalAmount ?? 0, taxRatePercent), 0, token));

        await recordPayment(invoice.id, payment.amount, payment.method, token);
      }

      await transitionOrderStatus(orderId, "Delivered", token, deliveredAtUtc);
      showToast("Order delivered.");
      setIsConfirmingDelivery(false);
      await load();
    } catch (error) {
      setDeliveryError(error instanceof ApiError ? error.message : "Unable to complete this delivery.");
    } finally {
      setIsTransitioning(false);
    }
  }

  function openDetailsForm() {
    if (!order) {
      return;
    }
    setEditCustomer(customer);
    // <input type="date"> only speaks yyyy-MM-dd.
    setEditDueAt(order.dueAtUtc.slice(0, 10));
    setEditNotes(order.notes ?? "");
    setDetailsError(null);
    setIsEditingDetails(true);
  }

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) {
      return;
    }
    setDetailsError(null);

    const customerId = editCustomer?.id ?? order.customerId;
    if (!editDueAt) {
      setDetailsError("Choose a collection date.");
      return;
    }

    setIsSavingDetails(true);
    try {
      await updateOrder(
        orderId,
        {
          customerId,
          // The employee is managed by its own section below; pass the current value through
          // rather than clearing it.
          employeeId: order.employeeId,
          dueAtUtc: new Date(`${editDueAt}T00:00:00Z`).toISOString(),
          notes: editNotes.trim() === "" ? null : editNotes,
        },
        getAccessToken(),
      );
      showToast("Order updated.");
      setIsEditingDetails(false);
      await load();
    } catch (error) {
      setDetailsError(error instanceof ApiError ? error.message : "Unable to update this order.");
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function openAssignDialog() {
    setAssignError(null);
    setAssignChoice("");
    setIsAssignOpen(true);
    setIsLoadingAssignOptions(true);

    try {
      // Read a page at a time up to the API's own ceiling, and keep going while there are more.
      // Asking for the whole roster in one request looked tidier but exceeded that ceiling, so the
      // call came back 400 and the dropdown was simply empty — the bug this replaces.
      const token = getAccessToken();
      const roster: Employee[] = [];
      for (let page = 1; page <= EMPLOYEE_PAGE_LIMIT; page += 1) {
        const { items, meta } = await searchEmployees("", page, MAX_PAGE_SIZE, token);
        roster.push(...items);
        if (page >= meta.totalPages) {
          break;
        }
      }

      // Retired staff are excluded. They stay in the system for the history on past orders, but
      // handing today's work to someone who has left is not a choice worth offering.
      setAssignOptions(roster.filter((employee) => employee.isActive));
    } catch (error) {
      setAssignError(error instanceof ApiError ? error.message : "Unable to load employees.");
    } finally {
      setIsLoadingAssignOptions(false);
    }
  }

  async function handleSubmitAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignError(null);

    if (assignChoice === "") {
      setAssignError("Choose an employee to assign.");
      return;
    }

    setIsAssigning(true);
    try {
      await assignOrderEmployee(orderId, assignChoice, getAccessToken());
      showToast("Employee assigned.");
      setIsAssignOpen(false);
      await load();
    } catch (error) {
      setAssignError(error instanceof ApiError ? error.message : "Unable to assign employee.");
    } finally {
      setIsAssigning(false);
    }
  }

  /**
   * The invoice is the order priced up, so there is nothing to fill in: the server sums this
   * order's items into the subtotal, the tax comes from the shop's rate in Invoice Settings, and
   * the discount is zero. Nobody at the counter should have to answer a question the order and the
   * settings already answer between them.
   */
  async function handleGenerateInvoice() {
    setInvoiceError(null);
    setIsCreatingInvoice(true);
    try {
      await createInvoice(orderId, taxAmountFor(order?.totalAmount ?? 0, taxRatePercent), 0, getAccessToken());
      showToast("Invoice generated.");
      // Stays on the order rather than jumping to the invoice page, the same way New Order does:
      // Generate turns into View and Print, and staff decide when to leave.
      await load();
    } catch (error) {
      setInvoiceError(error instanceof ApiError ? error.message : "Unable to create an invoice for this order.");
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {loadError}
      </p>
    );
  }

  if (!order) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  const nextStatuses = NEXT_STATUSES[order.status];
  // A delivered or cancelled order is finished with, so its details stop being editable.
  const canEditOrder = order.status !== "Delivered" && order.status !== "Cancelled";
  // Work cannot start on an order nobody holds — the server refuses it, so the screen offers the
  // assignment as its own step rather than letting the click come back as an error.
  const needsAssignment = !order.employeeId && nextStatuses.includes("InProgress");
  // The two moments an order is worth telling a customer about. Read off the status rather than
  // fired by the transition, so the offer survives a reload and a share can be sent again if the
  // first one never reached them — a message staff only get one chance at is a message that gets
  // missed.
  const statusShareKind: ShareKind | null =
    order.status === "ReadyForDelivery" ? "ready" : order.status === "Delivered" ? "delivered" : null;

  const activeInvoice = activeInvoiceOf(invoices ?? []);
  const hasVoidedInvoice = (invoices ?? []).some((invoice) => invoice.status === "Void");
  const delivery = deliveryFactsFor(order, invoices ?? [], taxRatePercent);

  return (
    <>
    <div className="flex flex-col gap-4 print:hidden">
      {/* Kept deliberately short. This screen is read standing at a counter with a garment in the
          other hand, so vertical space above the details is space the reader pays for. */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold leading-tight">Order</h1>
        <Link href="/dashboard/orders" className="text-sm text-foreground/70 hover:text-foreground">
          Back to orders
        </Link>
      </div>

      {/* Above the details, because "where is this order" is the question someone opens this screen
          holding — the particulars are what they read once they know. */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface px-6 py-4">
        <OrderWorkflow status={order.status} hasEmployee={Boolean(order.employeeId)} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Order Details</h2>
          {canEditOrder && !isEditingDetails && (
            <Button type="button" variant="secondary" onClick={openDetailsForm}>
              Edit Details
            </Button>
          )}
        </div>

        {isEditingDetails ? (
          <form onSubmit={handleSaveDetails} className="flex flex-col gap-3">
            <SearchPicker
              id="editCustomer"
              label="Customer"
              selectedLabel={editCustomer?.fullName ?? null}
              onSelect={setEditCustomer}
              search={searchCustomers}
              getId={(c) => c.id}
              getLabel={(c) => c.fullName}
              placeholder="Search customers…"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="editDueAt" className="text-sm">
                Collection date
              </label>
              <DateInput id="editDueAt" value={editDueAt} onChange={setEditDueAt} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="editNotes" className="text-sm">
                Notes
              </label>
              <textarea
                id="editNotes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className={fieldClassName}
              />
            </div>
            {detailsError && (
              <p role="alert" className="text-sm text-danger">
                {detailsError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditingDetails(false)} className="text-sm text-foreground/70 hover:text-foreground">
                Cancel
              </button>
              <Button type="submit" disabled={isSavingDetails}>
                {isSavingDetails ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          // Grouped by what each column answers: which order this is, what it is worth, who it is
          // for, and where it stands. Grouped in the markup rather than left to the grid's row-major
          // fill, so narrowing stacks each group whole instead of interleaving them. Two columns on
          // a tablet before four on a desktop — four across a narrow screen squeezes the amounts.
          <dl className="grid gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-4">
              <div>
                <dt className="text-foreground/70">Order Number</dt>
                {/* Falls back to the id for an order the deployed API created before it knew about
                    order numbers — the same fallback the Orders list uses. */}
                <dd className="font-mono font-medium">
                  {order.orderNumber?.trim() || `#${order.id.slice(0, 8).toUpperCase()}`}
                </dd>
              </div>
              <div>
                <dt className="text-foreground/70">Created Date</dt>
                <dd className="font-medium">{new Date(order.createdAtUtc).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">Created By</dt>
                {/* Placeholder until the API carries it: the order records who created it, but
                    OrderDto does not expose CreatedBy and the id would need resolving to a name.
                    The row is here so the layout is settled and only the value has to arrive. */}
                <dd className="font-medium text-foreground/50">—</dd>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <dt className="text-foreground/70">Total Amount</dt>
                <dd className="font-medium tabular-nums">{order.totalAmount.toFixed(2)}</dd>
              </div>
              <div>
                {/* The order's collected-so-far. Null only on a response produced by a write, which
                    this screen never renders — it reloads through getOrder after every change. */}
                <dt className="text-foreground/70">Advance</dt>
                <dd className="font-medium tabular-nums">{order.amountPaid?.toFixed(2) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">Balance</dt>
                {/* Outstanding money is the one number on this card worth spotting without reading,
                    so it carries colour where the others do not. Matches the Orders list. */}
                <dd
                  className={
                    order.balanceAmount !== null && order.balanceAmount > 0
                      ? "font-medium tabular-nums text-danger"
                      : "font-medium tabular-nums"
                  }
                >
                  {order.balanceAmount?.toFixed(2) ?? "—"}
                </dd>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <dt className="text-foreground/70">Customer Name</dt>
                <dd className="font-medium">{customer?.fullName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">Mobile Number</dt>
                <dd className="font-medium">{customer?.phoneNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">Assigned Employee</dt>
                {/* Distinguishes "nobody holds this yet" from "somebody does, but their record
                    would not load" — the first is a job to do, the second is a fault to report. */}
                <dd className="font-medium">
                  {assignedEmployee?.fullName ?? (order.employeeId ? "Assigned — record unavailable" : "—")}
                </dd>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <dt className="text-foreground/70">Status</dt>
                <dd className="mt-0.5">
                  <StatusBadge {...ORDER_STATUS_BADGE[order.status]} />
                </dd>
              </div>
            </div>
          </dl>
        )}

        {/* Delivered has no next status of its own, so the row has to be allowed to exist for the
            thank-you alone — otherwise the one message sent after the last transition would have
            nowhere to live. */}
        {(nextStatuses.length > 0 || statusShareKind) && !isEditingDetails && (
          <div className="mt-4 flex flex-wrap gap-3">
            {/* Assigning stands in for starting work until it is done. The two never appear together:
                one action at a time is the whole point of a workflow, and a disabled button asking to
                be understood was what this replaced. */}
            {needsAssignment && (
              <Button type="button" onClick={openAssignDialog}>
                Assign Employee
              </Button>
            )}

            {nextStatuses
              .filter((target) => !(target === "InProgress" && needsAssignment))
              .map((target) => (
                <Button
                  key={target}
                  type="button"
                  variant={target === "Cancelled" ? "danger" : "primary"}
                  disabled={isTransitioning}
                  onClick={() => startTransition(target)}
                >
                  Mark as {orderStatusLabel(target)}
                </Button>
              ))}

            {/* Beside the transition it follows from, not down with the invoice: this is news about
                the order, and the moment to send it is the moment the status was just changed. */}
            {statusShareKind && (
              <ShareViaWhatsAppButton
                kind={statusShareKind}
                customer={customer}
                invoice={activeInvoice}
                order={{ orderNumber: order.orderNumber, dueAtUtc: order.dueAtUtc }}
                shopName={branding.shopName || "Mathilens"}
                whatsAppApp={branding.whatsAppApp}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Invoice</h2>

            {/* Generating is the only action with nothing to sit under, so it stays in the header.
                Once the slip is there, View and Print go below it — see the foot of the card. */}
            {!activeInvoice && invoices !== null && (
              <Button type="button" disabled={isCreatingInvoice} onClick={() => setShowInvoiceConfirm(true)}>
                {isCreatingInvoice ? "Generating…" : "Generate Invoice"}
              </Button>
            )}
          </div>

          {invoices === null && <p className="text-sm text-foreground/70">Checking for an invoice…</p>}

          {activeInvoice &&
            (customer ? (
              <div className="flex flex-col gap-4">
                {/* The slip exactly as it prints — same component, so what is read here is what the
                    customer is handed. It sizes itself to this card, which is narrower than the
                    print modal, so the letterhead stacks here and sits side by side there. */}
                <div className="rounded-md border border-border p-4">
                  <InvoiceDocument invoice={activeInvoice} order={order} customer={customer} />
                </div>

                {/* One row under the slip for everything the shop does with it. None of this is on
                    the customer's copy: the status is the shop's own view of the invoice, and
                    taking money and voiding live on the invoice's own page. */}
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge {...INVOICE_STATUS_BADGE[activeInvoice.status]} />
                  <Link href={`/dashboard/invoices/${activeInvoice.id}`} className="text-sm text-primary hover:underline">
                    Record a payment
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAutoPrintInvoice(false);
                      setShowInvoiceModal(true);
                    }}
                  >
                    View Invoice
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAutoPrintInvoice(true);
                      setShowInvoiceModal(true);
                    }}
                  >
                    Print Invoice
                  </Button>
                  {/* Beside the invoice actions, as 10 asks: this is another way of handing the
                      customer the same document. */}
                  <ShareViaWhatsAppButton
                    customer={customer}
                    invoice={activeInvoice}
                    order={{ orderNumber: order.orderNumber, dueAtUtc: order.dueAtUtc }}
                    shopName={branding.shopName || "Mathilens"}
                    whatsAppApp={branding.whatsAppApp}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-danger">
                The customer record didn&apos;t load, so the invoice can&apos;t be built. Reload the page to try again.
              </p>
            ))}

          {invoices !== null && !activeInvoice && (
            <p className="text-sm text-foreground/70">
              {hasVoidedInvoice
                ? "This order's invoice was voided. Generate a new one when you're ready."
                : "No invoice raised for this order yet."}
            </p>
          )}

          {/* The order still exists whatever went wrong here, so the failure is reported in place
              and the button stays — not thrown away with a dialog the reader has already closed. */}
          {invoiceError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {invoiceError}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Order History</h2>
            {/* Says which customer and on what basis, in one line — the column is half the width it
                was, and the longer explanation was pushing the table itself below the fold. */}
            <p className="mt-1 text-sm text-foreground/70">
              Everything else this shop has made for {customer?.phoneNumber ?? "this customer"}, matched on the phone number.
            </p>
          </div>
          {previousOrders.length === 0 ? (
            <p className="text-sm text-foreground/70">No earlier orders for this customer.</p>
          ) : (
            <div className="table-wrap overflow-x-auto rounded-md border border-border">
              <table className="stacked w-full text-left text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Placed</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {previousOrders.map((previous) => (
                    <tr key={previous.id} className="border-b border-border last:border-0">
                      <td data-label="Order" className="px-3 py-2 font-mono">
                        <Link href={`/dashboard/orders/${previous.id}`} className="text-primary hover:underline">
                          {previous.orderNumber?.trim() || `#${previous.id.slice(0, 8).toUpperCase()}`}
                        </Link>
                      </td>
                      <td data-label="Placed" className="px-3 py-2">{new Date(previous.createdAtUtc).toLocaleDateString()}</td>
                      <td data-label="Status" className="px-3 py-2">
                        <StatusBadge {...ORDER_STATUS_BADGE[previous.status]} />
                      </td>
                      <td data-label="Amount" className="px-3 py-2 text-right tabular-nums">{previous.totalAmount.toFixed(2)}</td>
                      <td data-label="Balance"
                        className={
                          previous.balanceAmount !== null && previous.balanceAmount > 0
                            ? "px-3 py-2 text-right font-medium tabular-nums text-danger"
                            : "px-3 py-2 text-right tabular-nums"
                        }
                      >
                        {previous.balanceAmount?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* The same dialog the Orders list opens — one definition, so collecting the balance on the
          way out cannot end up meaning two different things depending on which screen it was
          started from. */}
      {isConfirmingDelivery && (
        <DeliveryDialog
          orderNumber={order.orderNumber?.trim() || `#${order.id.slice(0, 8).toUpperCase()}`}
          customerName={customer?.fullName ?? "—"}
          orderTotal={delivery.orderTotal}
          taxAmount={delivery.taxAmount}
          taxRatePercent={taxRatePercent}
          invoiceTotal={delivery.invoiceTotal}
          advancePaid={delivery.advancePaid}
          outstanding={delivery.outstanding}
          willRaiseInvoice={delivery.willRaiseInvoice}
          isConfirming={isTransitioning}
          error={deliveryError}
          onConfirm={handleDeliver}
          onCancel={() => setIsConfirmingDelivery(false)}
        />
      )}

      <Modal
        open={isAssignOpen}
        title="Assign Employee"
        description="Who is taking this order? Work cannot start until someone holds it."
        onClose={() => setIsAssignOpen(false)}
      >
        <form onSubmit={handleSubmitAssign} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="assignEmployeeChoice" className="text-sm font-medium">
              Employee
            </label>
            <select
              id="assignEmployeeChoice"
              value={assignChoice}
              onChange={(e) => setAssignChoice(e.target.value)}
              disabled={isLoadingAssignOptions || isAssigning}
              className={fieldClassName}
            >
              <option value="">{isLoadingAssignOptions ? "Loading employees…" : "Select an employee"}</option>
              {assignOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {/* Code alongside the name, because a shop can hold two Kumars and the code is
                      what tells them apart on a job card. */}
                  {employee.fullName}
                  {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
                </option>
              ))}
            </select>
            {!isLoadingAssignOptions && assignOptions.length === 0 && !assignError && (
              <p className="text-sm text-foreground/70">
                No active employees to assign. Add one, or bring a retired employee back, on the Employees screen.
              </p>
            )}
          </div>

          {assignError && (
            <p role="alert" className="text-sm text-danger">
              {assignError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAssignOpen(false)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAssigning || isLoadingAssignOptions || assignOptions.length === 0}>
              {isAssigning ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmed rather than done on the click, because an invoice is a document issued to a
          customer and the API will happily issue a second one. The totals are in the wording so the
          reader checks the figure, not just the intent — the same prompt New Order gives. */}
      <ConfirmDialog
        open={showInvoiceConfirm}
        title="Generate invoice"
        description={
          taxRatePercent > 0
            ? `Generate an invoice for this order now? ${order.totalAmount.toFixed(2)} for the items, plus ${taxAmountFor(order.totalAmount, taxRatePercent).toFixed(2)} tax at ${taxRatePercent}% — total ${(order.totalAmount + taxAmountFor(order.totalAmount, taxRatePercent)).toFixed(2)}.`
            : `Generate an invoice for this order now? Total ${order.totalAmount.toFixed(2)}, taken from the items on this order.`
        }
        confirmLabel="Generate"
        confirmingLabel="Generating…"
        confirmVariant="primary"
        isConfirming={isCreatingInvoice}
        onConfirm={() => {
          setShowInvoiceConfirm(false);
          handleGenerateInvoice();
        }}
        onCancel={() => setShowInvoiceConfirm(false)}
      />

    </div>

    {/* Outside the print:hidden wrapper above, so printing the invoice doesn't drag the rest of
        this screen onto the page behind it. Same arrangement as New Order. */}
    {showInvoiceModal && activeInvoice && customer && (
      <InvoicePrintModal
        invoice={activeInvoice}
        order={order}
        customer={customer}
        autoPrint={autoPrintInvoice}
        onClose={() => setShowInvoiceModal(false)}
      />
    )}
    </>
  );
}
