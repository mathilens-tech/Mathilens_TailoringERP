"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RowMenu } from "@/components/ui/RowMenu";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { StatusBadge, ORDER_STATUS_BADGE, orderStatusLabel } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportButton } from "@/components/ui/ExportButton";
import { useToast } from "@/components/ui/ToastProvider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import {
  searchOrders,
  deleteOrder,
  assignOrderEmployee,
  transitionOrderStatus,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/api/orders";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { searchEmployees, type Employee } from "@/lib/api/employees";
import { createInvoice, recordPayment, PAYMENT_METHODS, type Invoice, type PaymentMethod } from "@/lib/api/billing";
import { getInvoiceSettings, taxAmountFor, DEFAULT_INVOICE_SETTINGS } from "@/lib/api/invoice-settings";
import { findInvoicesForOrder, payableInvoiceOf, activeInvoiceOf, deliveryFactsFor } from "@/lib/api/order-invoices";
import { DeliveryDialog, type DeliveryPayment } from "@/components/orders/DeliveryDialog";
import { InvoicePrintModal } from "@/components/orders/InvoicePrintModal";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The largest page the API will accept — PaginationDefaults.MaxPageSize. Asking for more is a 400. */
const MAX_PAGE_SIZE = 100;

/** A shop with more staff than this is not choosing from a dropdown anyway. */
const EMPLOYEE_PAGE_LIMIT = 5;

/** Nobody holds it yet, and it hasn't finished — a delivered order needs no one assigned to it. */
function canAssign(order: Order): boolean {
  return !order.employeeId && order.status !== "Delivered" && order.status !== "Cancelled";
}

/** There is money outstanding on an order still being worked. */
function canReceiveBalance(order: Order): boolean {
  return (order.balanceAmount ?? 0) > 0 && order.status !== "Cancelled";
}

/**
 * How an order's next step is carried out: a dialog that collects something, or a plain transition.
 *
 * <p>Assigning picks a person and delivering records a date, so both stop to ask. Starting work and
 * marking ready ask nothing, so they happen on the click.</p>
 */
type NextStep =
  | { label: string; kind: "assign" }
  | { label: string; kind: "payment" }
  | { label: string; kind: "deliver" }
  | { label: string; kind: "invoice" }
  | { label: string; busyLabel: string; kind: "transition"; target: OrderStatus };

/**
 * The one thing an order is waiting for, or null once it is finished with.
 *
 * <p>This is what makes the actions column even: every row renders exactly one button from this,
 * in the same slot, so the eye finds the control without reading the row first. Reading down the
 * column also says what the shop's work actually is this morning.</p>
 *
 * <p>It mirrors the server's own transition table rather than guessing — Received leads to
 * InProgress and nowhere else, and work cannot start on an order nobody holds, so an unassigned
 * order's next step is the assignment.</p>
 */
function nextStepFor(order: Order): NextStep | null {
  switch (order.status) {
    case "Received":
      return order.employeeId
        ? { label: "Start Work", busyLabel: "Starting…", kind: "transition", target: "InProgress" }
        : { label: "Assign", kind: "assign" };
    case "InProgress":
      return { label: "Mark Ready", busyLabel: "Saving…", kind: "transition", target: "ReadyForDelivery" };
    case "ReadyForDelivery":
      // Deliver, whether or not money is owed. The server does refuse delivery while an invoice
      // still has a balance, but splitting that into "collect, then deliver" made the counter work
      // two rows for one handover — so the outstanding amount is collected inside the delivery
      // confirmation instead, and the shop still presses one button.
      return { label: "Deliver", kind: "deliver" };
    case "Delivered":
      // Nothing left to do to the order, but the bill is what gets asked for afterwards — a
      // customer back at the counter wanting their copy, or the shop reprinting one that smudged.
      return { label: "Invoice", kind: "invoice" };
    // Cancelled is terminal with nothing to show — the slot renders a dash so the column lines up.
    default:
      return null;
  }
}

/**
 * The shop's own reference — "MTL-0001".
 *
 * The fallback is a slice of the id, which is what this column showed before order numbers existed.
 * The AddOrderNumbers migration backfilled every order, so nothing should reach it; it is here so a
 * row can never render an empty cell where its identifier belongs.
 */
function orderNumber(order: Order) {
  return order.orderNumber?.trim() || `#${order.id.slice(0, 8).toUpperCase()}`;
}

export default function OrdersPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Each of the three row actions holds the order it was opened for rather than a boolean, so the
  // dialog knows which row it belongs to — a list has no single "current" order the way the detail
  // page does.
  const [assignTarget, setAssignTarget] = useState<Order | null>(null);
  const [assignOptions, setAssignOptions] = useState<Employee[]>([]);
  const [assignChoice, setAssignChoice] = useState("");
  const [isLoadingAssignOptions, setIsLoadingAssignOptions] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<Order | null>(null);
  // Found when the dialog opens, not per row: the lookup costs a request, and doing it for every
  // order on the page to decide whether to draw a button would be twenty requests for a list.
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [isFindingInvoice, setIsFindingInvoice] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  // Every invoice raised against the order being delivered, looked up when Deliver is pressed. The
  // whole list rather than just the payable one, so "this order has never been invoiced" can be
  // told apart from "its invoice is settled" — they need opposite handling.
  const [deliverInvoices, setDeliverInvoices] = useState<Invoice[]>([]);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  // The shop's rate, so an order that has to be invoiced on the way out is billed the same as one
  // invoiced at the counter.
  const [taxRatePercent, setTaxRatePercent] = useState(DEFAULT_INVOICE_SETTINGS.taxRatePercent);

  // Which row is mid-transition, so its button alone reads "Starting…" — a single isBusy flag would
  // put every row's button into the same pending state over one click.
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // The three things the printable slip needs, held together: found on the click, not per row.
  const [invoiceToShow, setInvoiceToShow] = useState<{ invoice: Invoice; order: Order; customer: Customer } | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchOrders(
        null,
        status || null,
        page,
        pageSize,
        getAccessToken(),
        debouncedSearch,
      );
      setOrders(items);
      setMeta(meta);

      const token = getAccessToken();
      const uniqueCustomerIds = Array.from(new Set(items.map((order) => order.customerId)));
      const customers = await Promise.all(
        uniqueCustomerIds.map((customerId) => getCustomer(customerId, token).catch(() => null)),
      );
      setCustomersById((prev) => {
        const next = { ...prev };
        customers.forEach((customer) => {
          if (customer) {
            next[customer.id] = customer;
          }
        });
        return next;
      });
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load orders.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, status, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    // Read once for the page rather than per delivery. Falls back to no tax if it can't be read —
    // better to under-charge and correct it than to put a figure on a customer's invoice that
    // nobody chose.
    getInvoiceSettings(getAccessToken())
      .then((settings) => setTaxRatePercent(settings.taxRatePercent))
      .catch(() => undefined);
  }, []);

  const delivery = deliveryFactsFor(deliverTarget, deliverInvoices, taxRatePercent);

  function handleStatusChange(value: string) {
    setStatus(value as OrderStatus | "");
    setPage(1);
  }

  // Back to page one on every change: narrowing the list while sitting on page four otherwise shows
  // an empty table, which reads as "no matches" rather than "your matches are on page one".
  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  /**
   * The roster is fetched once and kept, because the alternative is re-reading every employee each
   * time someone assigns a row and this is a screen where several get assigned in a sitting.
   */
  async function openAssign(order: Order) {
    setAssignTarget(order);
    setAssignChoice("");
    setAssignError(null);

    if (assignOptions.length > 0) {
      return;
    }

    setIsLoadingAssignOptions(true);
    try {
      // A page at a time up to the API's own ceiling, and keep going while there are more. Asking
      // for the whole roster in one request looked tidier but exceeded that ceiling, so the call
      // came back 400 and the dropdown was simply empty — the bug this shape exists to avoid.
      const token = getAccessToken();
      const roster: Employee[] = [];
      for (let rosterPage = 1; rosterPage <= EMPLOYEE_PAGE_LIMIT; rosterPage += 1) {
        const { items, meta: rosterMeta } = await searchEmployees("", rosterPage, MAX_PAGE_SIZE, token);
        roster.push(...items);
        if (rosterPage >= rosterMeta.totalPages) {
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

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignError(null);

    if (!assignTarget) {
      return;
    }

    if (assignChoice === "") {
      setAssignError("Choose an employee to assign.");
      return;
    }

    setIsAssigning(true);
    try {
      await assignOrderEmployee(assignTarget.id, assignChoice, getAccessToken());
      showToast("Employee assigned.");
      setAssignTarget(null);
      await loadOrders();
    } catch (error) {
      setAssignError(error instanceof ApiError ? error.message : "Unable to assign employee.");
    } finally {
      setIsAssigning(false);
    }
  }

  /**
   * Payment is taken against the invoice, not the order, so the invoice has to be found first.
   *
   * <p>The amount is pre-filled with the invoice's outstanding balance rather than the order's:
   * the two differ whenever tax is charged, and the invoice is the document the customer is
   * settling.</p>
   */
  async function openPayment(order: Order) {
    setPaymentTarget(order);
    setPaymentInvoice(null);
    setPaymentError(null);
    setPaymentAmount("");
    setPaymentMethod(PAYMENT_METHODS[0]);
    setIsFindingInvoice(true);

    try {
      const raised = await findInvoicesForOrder(order.id, order.customerId, getAccessToken());
      const invoice = payableInvoiceOf(raised);

      if (!invoice) {
        // Two different situations, and the difference matters to whoever is standing there: one is
        // a step not taken yet, the other is money already collected.
        setPaymentError(
          raised.some((candidate) => candidate.status !== "Void")
            ? "Every invoice raised for this order is settled. Nothing further is outstanding on it."
            : "No invoice has been raised for this order yet. Open the order and generate one first.",
        );
        return;
      }

      setPaymentInvoice(invoice);
      setPaymentAmount(invoice.remainingBalance.toFixed(2));
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "Unable to find this order's invoice.");
    } finally {
      setIsFindingInvoice(false);
    }
  }

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);

    if (!paymentInvoice) {
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }

    setIsRecordingPayment(true);
    try {
      await recordPayment(paymentInvoice.id, amount, paymentMethod, getAccessToken());
      showToast("Payment recorded.");
      setPaymentTarget(null);
      await loadOrders();
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "Unable to record this payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  }

  /**
   * Delivery needs to know what the order still owes, and the list deliberately doesn't carry that
   * per row — so the lookup happens on the click. The row's button holds its pending state while it
   * runs, rather than opening an empty dialog that fills in underneath the reader.
   */
  async function openDelivery(order: Order) {
    setBusyOrderId(order.id);
    setDeliveryError(null);

    try {
      setDeliverInvoices(await findInvoicesForOrder(order.id, order.customerId, getAccessToken()));
      setDeliverTarget(order);
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Unable to check what this order still owes.",
        "error",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  /** The transitions that collect nothing — starting work, and marking an order ready. */
  async function advance(order: Order, target: OrderStatus) {
    setBusyOrderId(order.id);
    try {
      await transitionOrderStatus(order.id, target, getAccessToken());
      showToast(`Order marked ${orderStatusLabel(target)}.`);
      await loadOrders();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to update the order status.", "error");
    } finally {
      setBusyOrderId(null);
    }
  }

  /**
   * The bill for an order already handed over, in the same printable slip the order page shows.
   *
   * <p>Opened here rather than navigating away: reprinting is usually something done with a
   * customer waiting, and coming back to the list afterwards would mean finding their row again.</p>
   */
  async function openInvoice(order: Order) {
    setBusyOrderId(order.id);

    try {
      const invoice = activeInvoiceOf(await findInvoicesForOrder(order.id, order.customerId, getAccessToken()));

      if (!invoice) {
        showToast("No invoice was raised for this order.", "error");
        return;
      }

      const customer = customersById[order.customerId];

      // The slip prints the customer's name and phone, so without that record there is no slip to
      // show. Their own page loads it independently, so send them there rather than nowhere.
      if (!customer) {
        router.push(`/dashboard/invoices/${invoice.id}`);
        return;
      }

      setInvoiceToShow({ invoice, order, customer });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to find this order's invoice.", "error");
    } finally {
      setBusyOrderId(null);
    }
  }

  /** One click, dispatched by what the step needs — a dialog to fill in, or the transition itself. */
  function runNextStep(order: Order, step: NextStep) {
    if (step.kind === "assign") {
      openAssign(order);
    } else if (step.kind === "payment") {
      openPayment(order);
    } else if (step.kind === "deliver") {
      openDelivery(order);
    } else if (step.kind === "invoice") {
      openInvoice(order);
    } else {
      advance(order, step.target);
    }
  }

  /**
   * The money, then the handover. In that order deliberately: the server refuses delivery while
   * anything is outstanding, so payment has to land first. If the transition then fails, the
   * payment stays recorded — which is right, because the shop did take it.
   */
  async function handleDeliver(deliveredAtUtc: string, payment: DeliveryPayment | null) {
    if (!deliverTarget) {
      return;
    }

    setDeliveryError(null);
    setIsDelivering(true);
    try {
      const token = getAccessToken();

      if (payment) {
        // Raised first when there is nothing to pay against — an order can reach Ready for Delivery
        // without ever being invoiced, and money cannot be recorded against thin air.
        const invoice =
          delivery.payable ??
          (await createInvoice(deliverTarget.id, taxAmountFor(deliverTarget.totalAmount, taxRatePercent), 0, token));

        await recordPayment(invoice.id, payment.amount, payment.method, token);
      }

      await transitionOrderStatus(deliverTarget.id, "Delivered", token, deliveredAtUtc);
      showToast("Order delivered.");
      setDeliverTarget(null);
      await loadOrders();
    } catch (error) {
      // Reported inside the dialog rather than as a toast: whatever was collected is still on
      // screen, and the server's refusal names the amount it is refusing over.
      setDeliveryError(error instanceof ApiError ? error.message : "Unable to complete this delivery.");
    } finally {
      setIsDelivering(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOrder(pendingDelete.id, getAccessToken());
      showToast("Order deleted.");
      setPendingDelete(null);
      await loadOrders();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to delete this order.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex items-center gap-3">
          <ExportButton
            resource="orders"
            label="orders"
            query={{
              ...(status ? { status } : {}),
              ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
            }}
          />
          <Link href="/dashboard/orders/new">
            <Button type="button">New Order</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {/* One box for all three, because whoever is at the counter has been handed one of them —
            a number off a receipt, a name, or a phone — and should not have to know which. */}
        <div className="min-w-0 flex-1 basis-64">
          <Input
            id="orderSearch"
            label="Search by order number, name or phone"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="e.g. MTL-0007, Asha, 98765…"
            autoCapitalize="none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="statusFilter" className="text-sm font-medium">
            Filter by status
          </label>
          <select
            id="statusFilter"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
          <option value="">All Status</option>
          {/* Through the shared label map, not the raw value: this dropdown was the one place the
              enum leaked to the screen as "ReadyForDelivery". */}
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-foreground/70">No orders found.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            {/* A tinted band rather than bg-surface, which is the same white the rows sit on — the
                header had nothing separating it from the first order but a hairline. Built from the
                theme's primary, so it follows dark mode instead of being a hard-coded colour. */}
            {/* A tinted band rather than bg-surface, which is the same white the rows sit on — the
                header had nothing separating it from the first order but a hairline. Built from the
                theme's primary, so it follows dark mode instead of being a hard-coded colour. */}
            <thead className="border-b border-border bg-primary/10 text-primary">
              <tr>
                {/* w-px with whitespace-nowrap is the shrink-to-fit idiom for an auto-layout table:
                    the declared width is a floor the browser has to widen to fit the content, so
                    each of these ends up exactly as wide as its longest cell and no wider. The
                    Actions column declares nothing, so it absorbs whatever is left over and the
                    data stays gathered at the near edge instead of drifting apart across a
                    wide screen. */}
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Order Number</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Customer Name</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Phone Number</th>
                {/* Amount and Advanced are on the order itself; the list carries only what is still
                    owed, which is the figure worth scanning a page of orders for. */}
                <th className="w-px whitespace-nowrap px-4 py-3 text-right font-semibold">Balance</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const customer = customersById[order.customerId];
                const step = nextStepFor(order);
                const isRowBusy = busyOrderId === order.id;
                return (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    {/* nowrap on the cells as well as the headers: a column is only as narrow as
                        its content if that content is allowed to stay on one line. */}
                    <td data-label="Order Number" className="whitespace-nowrap px-4 py-3 font-mono">
                      <Link href={`/dashboard/orders/${order.id}`} className="text-primary hover:underline">
                        {orderNumber(order)}
                      </Link>
                    </td>
                    <td data-label="Customer Name" className="whitespace-nowrap px-4 py-3">
                      {customer?.fullName ?? "—"}
                    </td>
                    <td data-label="Phone Number" className="whitespace-nowrap px-4 py-3">
                      {customer?.phoneNumber ?? "—"}
                    </td>
                    {/* Outstanding money is the number worth spotting from across the room. */}
                    <td
                      data-label="Balance"
                      className={
                        order.balanceAmount !== null && order.balanceAmount > 0
                          ? "whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-danger"
                          : "whitespace-nowrap px-4 py-3 text-right tabular-nums"
                      }
                    >
                      {order.balanceAmount?.toFixed(2) ?? "—"}
                    </td>
                    <td data-label="Status" className="whitespace-nowrap px-4 py-3">
                      <StatusBadge {...ORDER_STATUS_BADGE[order.status]} />
                    </td>
                    {/* One button and one menu on every row, whatever state the order is in. The
                        button is the order's next step; everything else is behind the menu. A
                        column where the controls sit in the same place on every line can be used
                        without being read, which the previous set — a different handful of links
                        per row depending on status — could not. */}
                    <td data-label="" className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Fixed width, so a row whose step is "Mark Ready" doesn't push the menu
                            out of line with the row above it. The dash holds the slot open for an
                            order that has nothing left to do — centred in that slot, where the
                            button's own label sits, rather than shoved against its right edge. */}
                        <div className="flex w-[7.5rem] shrink-0 justify-center">
                          {step ? (
                            <Button
                              type="button"
                              // Secondary for the invoice: it is not a step the order is waiting on,
                              // and drawing finished rows in the same solid indigo as the ones
                              // needing work would flatten the distinction the column exists to make.
                              variant={step.kind === "invoice" ? "secondary" : "primary"}
                              disabled={isRowBusy}
                              onClick={() => runNextStep(order, step)}
                              className="w-full"
                            >
                              {isRowBusy && step.kind === "transition" ? step.busyLabel : step.label}
                            </Button>
                          ) : (
                            <span className="text-foreground/40">—</span>
                          )}
                        </div>

                        <RowMenu
                          label={`Actions for order ${orderNumber(order)}`}
                          items={[
                            {
                              label: "Assign Employee",
                              onSelect: () => openAssign(order),
                              disabled: !canAssign(order),
                              reason: order.employeeId ? "Already assigned" : "This order is finished with",
                            },
                            {
                              label: "Balance",
                              onSelect: () => openPayment(order),
                              disabled: !canReceiveBalance(order),
                              reason: order.status === "Cancelled" ? "This order was cancelled" : "Nothing outstanding",
                            },
                            {
                              // Present even when the balance has pushed it out of the button slot,
                              // so "collect first" stays a recommendation rather than a barrier —
                              // the server, not this list, is what actually refuses.
                              label: "Mark Delivered",
                              onSelect: () => openDelivery(order),
                              disabled: order.status !== "ReadyForDelivery",
                              reason:
                                order.status === "Delivered" ? "Already delivered" : "Not ready for delivery yet",
                            },
                            { label: "View order", onSelect: () => router.push(`/dashboard/orders/${order.id}`) },
                            { label: "Delete order", onSelect: () => setPendingDelete(order), variant: "danger" },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />}

      <Modal
        open={assignTarget !== null}
        title="Assign Employee"
        description={
          assignTarget
            ? `Who is taking order ${orderNumber(assignTarget)}? Work cannot start until someone holds it.`
            : ""
        }
        onClose={() => setAssignTarget(null)}
      >
        <form onSubmit={handleAssign} className="flex flex-col gap-4">
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
            <Button type="button" variant="secondary" onClick={() => setAssignTarget(null)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAssigning || isLoadingAssignOptions || assignOptions.length === 0}>
              {isAssigning ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={paymentTarget !== null}
        title="Balance"
        description={
          paymentTarget ? `Money taken against order ${orderNumber(paymentTarget)}.` : ""
        }
        onClose={() => setPaymentTarget(null)}
      >
        {isFindingInvoice ? (
          <p className="text-sm text-foreground/70">Finding this order&apos;s invoice…</p>
        ) : paymentInvoice ? (
          <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
            {/* Named and totalled, because the amount below is settling this document and not the
                order — the two differ by the tax whenever the shop charges any. */}
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-foreground/70">Invoice</dt>
                <dd className="font-mono font-medium">
                  {paymentInvoice.invoiceNumber?.trim() || `#${paymentInvoice.id.slice(0, 8).toUpperCase()}`}
                </dd>
              </div>
              <div>
                <dt className="text-foreground/70">Total</dt>
                <dd className="font-medium tabular-nums">{paymentInvoice.totalAmount.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">Outstanding</dt>
                <dd className="font-medium tabular-nums text-danger">{paymentInvoice.remainingBalance.toFixed(2)}</dd>
              </div>
            </dl>

            {/* Pre-filled with the whole outstanding amount, since settling in full is what happens
                at a counter most of the time — and it is a figure to check, not to type out. */}
            <Input
              id="paymentAmount"
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={isRecordingPayment}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="paymentMethod" className="text-sm font-medium">
                Method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                disabled={isRecordingPayment}
                className={fieldClassName}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            {paymentError && (
              <p role="alert" className="text-sm text-danger">
                {paymentError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPaymentTarget(null)} disabled={isRecordingPayment}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRecordingPayment}>
                {isRecordingPayment ? "Recording…" : "Record payment"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-danger">
              {paymentError ?? "Unable to find this order's invoice."}
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPaymentTarget(null)}>
                Close
              </Button>
              {paymentTarget && (
                <Link href={`/dashboard/orders/${paymentTarget.id}`}>
                  <Button type="button">Open order</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Rendered only while it is open, so each delivery starts from the order in front of the
          reader rather than the last one's figures. */}
      {deliverTarget && (
        <DeliveryDialog
          orderNumber={orderNumber(deliverTarget)}
          customerName={customersById[deliverTarget.customerId]?.fullName ?? "—"}
          orderTotal={delivery.orderTotal}
          taxAmount={delivery.taxAmount}
          taxRatePercent={taxRatePercent}
          invoiceTotal={delivery.invoiceTotal}
          advancePaid={delivery.advancePaid}
          outstanding={delivery.outstanding}
          willRaiseInvoice={delivery.willRaiseInvoice}
          isConfirming={isDelivering}
          error={deliveryError}
          onConfirm={handleDeliver}
          onCancel={() => setDeliverTarget(null)}
        />
      )}

      {/* Outside every other dialog, and last: printing hides the rest of the page, so the slip has
          to be the only thing the print stylesheet leaves standing. */}
      {invoiceToShow && (
        <InvoicePrintModal
          invoice={invoiceToShow.invoice}
          order={invoiceToShow.order}
          customer={invoiceToShow.customer}
          onClose={() => setInvoiceToShow(null)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete order"
        description={
          pendingDelete
            ? `Are you sure you want to delete order ${orderNumber(pendingDelete)}? To keep it in reporting, cancel it instead.`
            : ""
        }
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
