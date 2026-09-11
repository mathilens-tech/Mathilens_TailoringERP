"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
// Only the cleaner: the fields it used to serve went with the hand-rolled New Customer form, but
// what is typed into the search box is still tidied to the same rule before seeding the dialog.
import { cleanPhoneNumberInput } from "@/components/ui/PhoneNumberInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  OrderItemsEditor,
  clothAmount,
  rowTotal,
  MAX_ITEM_QUANTITY,
  type ItemRow,
} from "@/components/orders/OrderItemsEditor";
import {
  effectiveBusinessMode,
  isFabricOnly,
  orderKindMeta,
  type OrderKind,
} from "@/lib/orders/order-kind";
import { InvoicePrintModal } from "@/components/orders/InvoicePrintModal";
import { useMeasurementFields } from "@/lib/use-measurement-templates";
import { useToast } from "@/components/ui/ToastProvider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { searchCustomers, createCustomer, type Customer, type CustomerInput } from "@/lib/api/customers";
import { CustomerForm } from "@/app/dashboard/customers/CustomerForm";
import { Modal } from "@/components/ui/Modal";
import { searchEmployees, type Employee } from "@/lib/api/employees";
import { createOrder, type CreateOrderItemInput, type Order } from "@/lib/api/orders";
import {
  listMeasurementsForCustomer,
  createMeasurement,
  updateMeasurementValues,
  type Measurement,
  type MeasurementValue,
} from "@/lib/api/measurements";
import {
  MeasurementPointInput,
  toFieldText,
  toMeasurementValue,
} from "@/components/measurements/MeasurementPointInput";
import { getSetting, DEFAULT_ORDER_DUE_DATE_DAYS_KEY } from "@/lib/api/settings";
import { getShopCalendar, nextOpenDay, toIsoDate, WEEKDAYS } from "@/lib/api/shop-calendar";
import { getTailoringRates, type TailoringRates } from "@/lib/api/tailoring-rates";
import { getGarments, type Garment } from "@/lib/api/garments";
import { createInvoice, recordPayment, PAYMENT_METHODS, type PaymentMethod, type Invoice } from "@/lib/api/billing";
import { getInvoiceSettings, taxAmountFor, DEFAULT_INVOICE_SETTINGS } from "@/lib/api/invoice-settings";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { ShareViaWhatsAppButton } from "@/components/whatsapp/ShareViaWhatsAppButton";
import { PaymentMethodPicker } from "@/components/billing/PaymentMethodPicker";
import { useBranding } from "@/lib/use-branding";
import { DateInput } from "@/components/ui/DateInput";

/* One field treatment for the whole page, matching the Input component the rest of the app uses:
   white fill, hairline border, blue focus ring, and a disabled state that stays readable rather
   than fading to half opacity. */
const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50";

/** Matches MeasurementConfiguration's column length, so the server never has to refuse a note the
 *  field allowed someone to finish typing. */
const MEASUREMENT_NOTES_MAX_LENGTH = 1000;

/** Money, as this page shows it — the figures are read as amounts, not typed into. */
function money(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/** A tape measure on its reel — the measurement panel's empty state, drawn inline like the nav's
 *  own icons rather than pulled from a package for one glyph. */
function TapeMeasureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="20" height="9" rx="2" />
      <path d="M6 8v3M10 8v4M14 8v3M18 8v4" />
    </svg>
  );
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** A blank customer, for seeding the New Customer dialog with whatever was typed into the search. */
const EMPTY_CUSTOMER: CustomerInput = {
  fullName: "",
  phoneNumber: "",
  email: null,
  address: null,
  notes: null,
  gender: null,
  religion: null,
  dateOfBirth: null,
  weddingDate: null,
};

/** The server rejects anything above 100 (Shared/Constants/PaginationDefaults.cs). */
const EMPLOYEE_PAGE_SIZE = 100;
/** 500 staff is far past any tailoring shop; the cap only exists so a bad meta can't loop forever. */
const EMPLOYEE_PAGE_LIMIT = 5;

/** The weekday of the yyyy-MM-dd a date input holds, or null while the field is empty or half-typed. */
function weekdayOf(isoDate: string): (typeof WEEKDAYS)[number] | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

export type NewOrderFormProps = {
  /**
   * Which of the three order screens this is. Decided by the route rather than by a control on the
   * page, so the form can ask only for what that kind of order actually has — see
   * `@/lib/orders/order-kind`.
   */
  kind: OrderKind;
};

/**
 * The order-writing form, shared by all three New Order screens.
 *
 * One component rather than three, because everything below the kind — the customer, the schedule,
 * measurements, the discount, the advance and the invoice — is identical across them, and three
 * copies of that would drift the moment one was fixed. What differs is only which fields are asked
 * for, and that is derived from `kind` at the top.
 */
export function NewOrderForm({ kind }: NewOrderFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  // The shop's name, for the WhatsApp message to greet and sign off with.
  const branding = useBranding();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [mobileNumber, setMobileNumber] = useState("");
  const debouncedMobileNumber = useDebouncedValue(mobileNumber, 300);
  const [mobileMatches, setMobileMatches] = useState<Customer[]>([]);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  /**
   * Whatever was typed into the search box, carried into the dialog so it is not typed twice.
   *
   * One object rather than a field per box, because the form it seeds is the shop's whole customer
   * form now — the three fields this screen used to ask for were its own smaller copy of it.
   */
  const [newCustomerSeed, setNewCustomerSeed] = useState<CustomerInput>(EMPTY_CUSTOMER);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [dueAtUtc, setDueAtUtc] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const kindMeta = orderKindMeta(kind);
  /**
   * How the form prices and renders itself.
   *
   * Derived from the chosen screen, not fetched: the route has already answered whose cloth this
   * is, so a tailoring order prices as tailoring-only even in a shop that sells fabric — asking the
   * rows again whose material it is would be asking a question the screen's own name answers. The
   * shop's `BusinessMode` still decides which of the three screens exist; that gate lives on the
   * routes, because a form that has been reached should not be able to conclude it should not have
   * been.
   *
   * Kept under the old name so every calculation below reads exactly as it did.
   */
  const businessMode = effectiveBusinessMode(kind);
  /** Cloth with nothing being stitched — no garment, no tailor, no collection date. */
  const isFabricSale = isFabricOnly(kind);
  const [tailoringRates, setTailoringRates] = useState<TailoringRates>({});
  const [garments, setGarments] = useState<Garment[]>([]);
  // What an item row may be for: on the shop's garment list and carrying a stitching price. A
  // garment nobody has priced would put a zero on the bill, so it is not offered at all.
  //
  // Memoised because the item editor watches this list in an effect — a fresh array on every render
  // would re-run that effect on every keystroke in the form.
  const offerableGarments = useMemo(
    () => garments.filter((garment) => tailoringRates[garment.name] !== undefined),
    [garments, tailoringRates],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [activeMeasurementItemId, setActiveMeasurementItemId] = useState<number | null>(null);
  const [customerMeasurements, setCustomerMeasurements] = useState<Measurement[]>([]);
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  /**
   * Money taken off the bill before anything is paid against it.
   *
   * Held here rather than on the item rows: a shop discounts an order — "make it 2000" — not a
   * garment, and the invoice carries a single discount amount, so splitting it per line would be
   * inventing a number nothing stores.
   */
  const [discountAmount, setDiscountAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  /** The fitting remark for the active item's garment — saved with the values, by the same button. */
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [measurementFormError, setMeasurementFormError] = useState<string | null>(null);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  // Which cell opened the Order Summary Preview — both the Order summary cell and the Schedule
  // cell open the same panel, and the one that was clicked is the one that gets highlighted.
  const [summarySource, setSummarySource] = useState<"summary" | "schedule" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  const isOrderCreated = createdOrder !== null;
  const isViewingSummary = summarySource !== null;
  const collectionWeekday = weekdayOf(dueAtUtc);

  const activeMeasurementItemIndex = itemRows.findIndex((row) => row.id === activeMeasurementItemId);
  const activeMeasurementItem = activeMeasurementItemIndex === -1 ? null : itemRows[activeMeasurementItemIndex];
  const activeMeasurement = activeMeasurementItem ? (customerMeasurements.find((m) => m.garmentType === activeMeasurementItem.garmentType) ?? null) : null;

  // Split into two side-by-side halves within one merged block (00_MASTER_SPEC.md § 9.6) rather
  // than one long list. The points themselves come from the shop's configured template
  // (Settings › Measurement Templates), in its configured order.
  const { fields: measurementFields, isLoading: isLoadingTemplate } =
    useMeasurementFields(activeMeasurementItem?.garmentType ?? null);
  const measurementFieldsFirstHalf = measurementFields.slice(0, Math.ceil(measurementFields.length / 2));
  const measurementFieldsSecondHalf = measurementFields.slice(Math.ceil(measurementFields.length / 2));

  const itemsAreaRef = useRef<HTMLDivElement>(null);
  const measurementBlockRef = useRef<HTMLDivElement>(null);
  const mobileFieldRef = useRef<HTMLDivElement>(null);
  const orderSummaryRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeMeasurementItem && !isViewingSummary) {
      return;
    }

    // Clicking an item card opens the measurement panel, clicking Order summary opens the invoice
    // preview, and so does the Schedule cell next to it — clicking anywhere else (Customer field,
    // blank space, etc.) should close whichever one is open, same as their own Close button — but
    // a click inside the panel, or inside either cell that opens it, must not count as "elsewhere".
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        itemsAreaRef.current?.contains(target) ||
        measurementBlockRef.current?.contains(target) ||
        orderSummaryRef.current?.contains(target) ||
        scheduleRef.current?.contains(target)
      ) {
        return;
      }
      setActiveMeasurementItemId(null);
      setSummarySource(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeMeasurementItem, isViewingSummary]);

  useEffect(() => {
    if (!isMobileDropdownOpen) {
      return;
    }

    // Same outside-click-closes pattern as the measurement panel above — a click on the dropdown
    // itself (picking a match) must not count as "elsewhere".
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (mobileFieldRef.current?.contains(target)) {
        return;
      }
      setIsMobileDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMobileDropdownOpen]);

  useEffect(() => {
    if (!activeMeasurementItem) {
      return;
    }
    const initial: Record<string, string> = {};
    if (activeMeasurement) {
      for (const [name, value] of Object.entries(activeMeasurement.values)) {
        initial[name] = toFieldText(value);
      }
    }
    // Keyed on the item/measurement identity, not the objects themselves — re-runs exactly when
    // switching targets, not on every unrelated re-render. See CustomersPage for why this
    // reset-on-dependency-change pattern is intentionally not restructured around the
    // set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeasurementValues(initial);
    setMeasurementNotes(activeMeasurement?.notes ?? "");
    setMeasurementFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeasurementItem?.id, activeMeasurement?.id]);

  // Cloth plus stitching, row by row. Tolerant of blank input so the total moves as the owner
  // types, unlike handleCreateOrder's strict per-item validation at submit time.
  const itemRowTotal = (row: ItemRow) => rowTotal(row, businessMode);
  const orderTotal = itemRows.reduce((sum, row) => sum + itemRowTotal(row), 0);
  const discountValue = discountAmount.trim() === "" ? 0 : Number(discountAmount);
  const safeDiscount = Number.isFinite(discountValue) && discountValue > 0 ? discountValue : 0;
  // What the customer actually owes, which is what every figure below is measured against: the
  // advance is paid off this, not off the undiscounted total, and so is the balance.
  const payableTotal = Math.max(orderTotal - safeDiscount, 0);
  const advanceValue = advanceAmount.trim() === "" ? 0 : Number(advanceAmount);
  const orderBalance = payableTotal - (Number.isFinite(advanceValue) ? advanceValue : 0);

  // The two halves orderTotal is already made of, shown separately so the summary answers "what am
  // I paying for?" rather than only "how much?". Nothing new is calculated: rowTotal is defined as
  // cloth + quantity x tailoring, so these two necessarily add back up to orderTotal above, and the
  // figure the order is created with is untouched.
  const clothTotal = itemRows.reduce((sum, row) => sum + clothAmount(row, businessMode), 0);
  const tailoringTotal = orderTotal - clothTotal;
  // Garments, not rows — two shirts and a trousers is three items to the shop, on two lines.
  const totalItems = itemRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  function selectCustomer(selected: Customer) {
    setCustomer(selected);
    setMobileNumber("");
    setMobileMatches([]);
    setIsMobileDropdownOpen(false);
    setIsAddingNewCustomer(false);
  }

  function clearCustomer() {
    setCustomer(null);
    setMobileNumber("");
    setMobileMatches([]);
    setIsMobileDropdownOpen(false);
    setActiveMeasurementItemId(null);
  }

  function startAddingNewCustomer(query: string, field: "name" | "phone" = "name") {
    setNewCustomerSeed({
      ...EMPTY_CUSTOMER,
      fullName: field === "name" ? query : "",
      // Carried over from the search box, which accepts a name too — so it is cleaned to the same
      // rule the field enforces rather than dropped in raw.
      phoneNumber: field === "phone" ? (cleanPhoneNumberInput(query) ?? "") : "",
    });
    setIsAddingNewCustomer(true);
    setIsMobileDropdownOpen(false);
    setActiveMeasurementItemId(null);
    setSummarySource(null);
  }

  function handleItemClick(row: ItemRow) {
    setActiveMeasurementItemId(row.id);
    setIsAddingNewCustomer(false);
    setSummarySource(null);
  }

  function handleOpenSummary(source: "summary" | "schedule") {
    setSummarySource(source);
    setActiveMeasurementItemId(null);
    setIsAddingNewCustomer(false);
  }

  function handleClearMeasurement() {
    setMeasurementFormError(null);
    setMeasurementValues({});
    setMeasurementNotes("");
  }

  async function handleSaveMeasurement() {
    if (!activeMeasurementItem || !customer) {
      return;
    }
    setMeasurementFormError(null);

    const values: Record<string, MeasurementValue> = {};
    for (const point of measurementFields) {
      const raw = measurementValues[point.name] ?? "";
      // Points are individually optional — one nobody has filled in yet is skipped rather than
      // blocking the save. A checkbox is never skipped: "no" is an answer.
      const value = toMeasurementValue(point, raw);
      if (value === null) {
        if (point.type === "Number" && raw.trim() !== "") {
          setMeasurementFormError(`"${point.name}" needs a value greater than zero.`);
          return;
        }
        continue;
      }
      values[point.name] = value;
    }

    if (Object.keys(values).length === 0) {
      setMeasurementFormError("Add at least one measurement point.");
      return;
    }

    setIsSavingMeasurement(true);
    try {
      const saved = activeMeasurement
        ? await updateMeasurementValues(activeMeasurement.id, values, getAccessToken(), measurementNotes)
        : await createMeasurement(customer.id, activeMeasurementItem.garmentType, values, getAccessToken(), measurementNotes);
      setCustomerMeasurements((prev) => [...prev.filter((m) => m.id !== saved.id), saved]);
      showToast("Measurement saved.");
      // Stays open after saving — closing would hide the panel the moment it's saved. Clear
      // resets the fields; Close (in column 2) exits.
    } catch (error) {
      setMeasurementFormError(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.");
    } finally {
      setIsSavingMeasurement(false);
    }
  }

  useEffect(() => {
    if (!debouncedMobileNumber || customer) {
      // No direct setState here for the empty/already-selected case — mirrors SearchPicker's
      // own reasoning: stale results simply aren't rendered rather than being actively cleared.
      return;
    }

    let cancelled = false;
    searchCustomers(debouncedMobileNumber, 1, 10, getAccessToken())
      .then(({ items }) => {
        if (cancelled) {
          return;
        }
        const normalizedQuery = digitsOnly(debouncedMobileNumber);
        const exactMatches = items.filter((c) => digitsOnly(c.phoneNumber) === normalizedQuery);
        if (exactMatches.length === 1) {
          selectCustomer(exactMatches[0]);
          return;
        }
        setMobileMatches(items);
      })
      .catch(() => {
        if (!cancelled) {
          setMobileMatches([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedMobileNumber, customer]);

  const loadCustomerMeasurements = useCallback(async () => {
    if (!customer) {
      return;
    }
    setIsLoadingMeasurements(true);
    try {
      const data = await listMeasurementsForCustomer(customer.id, getAccessToken());
      setCustomerMeasurements(data);
    } catch {
      setCustomerMeasurements([]);
    } finally {
      setIsLoadingMeasurements(false);
    }
  }, [customer]);

  useEffect(() => {
    // Loads the selected customer's existing measurements so the per-item panel below can tell
    // whether a garment type already has one on file (update) or not (create).
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomerMeasurements();
  }, [loadCustomerMeasurements]);

  const applyDefaultDueDate = useCallback(() => {
    // Pre-fills Collection date from the shop's configured turnaround (Settings › Order Duration)
    // — different shops commit to different lead times, so this isn't hardcoded — then rolls it
    // forward off any day the shop is shut (Settings › Working Days). Add five days on a Tuesday
    // and the answer used to be Sunday; now it is the Monday after.
    //
    // Silently does nothing if the turnaround was never configured; the functional update leaves a
    // value the user already typed untouched, in case this resolves after they started the form.
    Promise.all([
      getSetting(DEFAULT_ORDER_DUE_DATE_DAYS_KEY, getAccessToken()),
      // Never rejects — an unconfigured shop calendar falls back to "closed Sundays".
      getShopCalendar(getAccessToken()),
    ])
      .then(([setting, calendar]) => {
        const days = Number(setting.value);
        if (!Number.isFinite(days) || days <= 0) {
          return;
        }
        const due = new Date();
        due.setDate(due.getDate() + days);
        // toIsoDate off the local calendar, not toISOString: a due date computed late in the
        // evening east of UTC would otherwise be written down as the day before.
        const isoDate = nextOpenDay(toIsoDate(due), calendar);
        setDueAtUtc((current) => current || isoDate);
      })
      .catch(() => {
        // No turnaround configured — Collection date stays blank, same as before this existed.
      });
  }, []);

  useEffect(() => {
    applyDefaultDueDate();
  }, [applyDefaultDueDate]);

  useEffect(() => {
    // What an item row can be: the garments the shop stitches (Settings › Garments), what it
    // charges for them (Settings › Tailoring Cost), and whether it sells the cloth as well
    // (Settings › Business Mode). Read once here so no row has to ask for any of them. None
    // rejects — a shop that has set no prices gets no garments to pick, which is the message below
    // rather than an error, and an unconfigured business mode falls back to tailoring-only.
    let cancelled = false;
    Promise.all([getTailoringRates(getAccessToken()), getGarments(getAccessToken())]).then(([rates, list]) => {
      if (!cancelled) {
        setTailoringRates(rates);
        setGarments(list);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // The whole roster, once, for the Assigned employee list. 200 is far above any real shop's
    // headcount and still one request; a shop that outgrows it would need paging here anyway.
    let cancelled = false;

    // Paged rather than asked for in one go: the server caps pageSize at 100
    // (Shared/Constants/PaginationDefaults.cs) and rejects anything larger, so a single request
    // for the whole roster came back a validation error and left this list empty.
    async function loadEveryEmployee() {
      const all: Employee[] = [];
      for (let page = 1; page <= EMPLOYEE_PAGE_LIMIT; page++) {
        const { items, meta } = await searchEmployees("", page, EMPLOYEE_PAGE_SIZE, getAccessToken());
        all.push(...items);
        if (page >= meta.totalPages) {
          break;
        }
      }
      return all;
    }

    loadEveryEmployee()
      .then((items) => {
        if (!cancelled) {
          // Retired staff are dropped — assigning new work to someone who has left is never right.
          setEmployees(items.filter((candidate) => candidate.isActive));
        }
      })
      .catch(() => {
        // Leaves the list with only "Not assigned", which is a working order rather than a dead form.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEmployees(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleStartNewOrder() {
    // Resets every field back to a blank form — the Add item/quantity/etc. rows live inside
    // OrderItemsEditor's own state, so bumping formKey remounts it instead of trying to reach in.
    setCustomer(null);
    setMobileNumber("");
    setMobileMatches([]);
    setIsMobileDropdownOpen(false);
    setIsAddingNewCustomer(false);
    setNewCustomerSeed(EMPTY_CUSTOMER);
    setEmployee(null);
    setDueAtUtc("");
    setItemRows([]);
    setIsSubmitting(false);
    setCreatedOrder(null);
    setIsGeneratingInvoice(false);
    setCreatedInvoice(null);
    setShowInvoiceModal(false);
    setAutoPrintInvoice(false);
    setActiveMeasurementItemId(null);
    setCustomerMeasurements([]);
    setAdvanceAmount("");
    setDiscountAmount("");
    setAdvanceMethod(PAYMENT_METHODS[0]);
    setMeasurementValues({});
    setMeasurementNotes("");
    setMeasurementFormError(null);
    setSummarySource(null);
    setFormKey((key) => key + 1);
    applyDefaultDueDate();
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer) {
      showToast("Select a customer.", "error");
      return;
    }
    if (!dueAtUtc) {
      showToast("Set a collection date.", "error");
      return;
    }

    const sellsFabric = businessMode === "tailoringFabric";

    // A counter sale is cloth and nothing else: each line is priced at what the cloth came to, the
    // quantity is the one length being sold, and there is no stitching charge to add. Quantity stays
    // 1 rather than the metre count because the API's quantity is a whole number — the metres live
    // on the fabric record, where they are a decimal and where stock reads them from.
    if (isFabricSale) {
      const saleItems: CreateOrderItemInput[] = [];
      for (const row of itemRows) {
        if (row.clothCode.trim() === "" && row.metres.trim() === "") {
          continue;
        }

        const metres = Number(row.metres);
        const ratePerMetre = Number(row.ratePerMetre);
        if (!row.clothCode.trim() || !Number.isFinite(metres) || metres <= 0 || ratePerMetre <= 0) {
          showToast("Every cloth line needs a code, metres and a rate.", "error");
          return;
        }

        saleItems.push({
          garmentType: row.clothName.trim() === "" ? row.clothCode.trim() : row.clothName,
          quantity: 1,
          unitPrice: metres * ratePerMetre,
          fabric: {
            fabricType: row.clothName.trim() === "" ? row.clothCode.trim() : row.clothName,
            source: "ShopSupplied" as const,
            color: null,
            quantity: metres,
            clothCode: row.clothCode.trim(),
            unit: "Metres" as const,
          },
        });
      }

      if (saleItems.length === 0) {
        showToast("Add at least one cloth line.", "error");
        return;
      }

      if (!Number.isFinite(advanceValue) || advanceValue < 0 || advanceValue > orderTotal) {
        showToast("Amount paid must be between zero and the sale total.", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        const order = await createOrder(
          {
            customerId: customer.id,
            // No tailor and no date to promise: the server refuses an employee on a sale, and reads
            // this moment as when the cloth went across the counter.
            employeeId: null,
            dueAtUtc: new Date().toISOString(),
            notes: orderNotes.trim() === "" ? null : orderNotes,
            items: saleItems,
            isFabricSale: true,
          },
          getAccessToken(),
        );
        setCreatedOrder(order);
        showToast("Sale recorded.");
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.", "error");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const items: CreateOrderItemInput[] = [];
    for (const row of itemRows) {
      // The form starts with blank placeholder rows so staff don't have to click "+ Add item" for
      // a typical order — untouched ones are silently skipped rather than blocking submission.
      const isUntouched =
        row.tailoringRate.trim() === "" && row.clothCode.trim() === "" && row.metres.trim() === "";
      if (isUntouched) {
        continue;
      }

      const quantity = Number(row.quantity);
      const tailoring = Number(row.tailoringRate);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(tailoring) || tailoring <= 0) {
        showToast("Every item needs a quantity and a tailoring amount.", "error");
        return;
      }
      // Said here as well as by the field's own max, so a number that arrives by paste or by an
      // older browser that ignores the attribute is still caught before it becomes a bill.
      if (quantity > MAX_ITEM_QUANTITY) {
        showToast(`Quantity can't be more than ${MAX_ITEM_QUANTITY.toLocaleString()}.`, "error");
        return;
      }

      const usesShopFabric = sellsFabric && row.fabricSource === "internal";
      const metres = Number(row.metres);
      const ratePerMetre = Number(row.ratePerMetre);
      if (usesShopFabric && (!row.clothCode.trim() || !Number.isFinite(metres) || metres <= 0 || ratePerMetre <= 0)) {
        showToast("Shop fabric needs a cloth code, metres and a rate.", "error");
        return;
      }

      const fabric = usesShopFabric
        ? {
            fabricType: row.clothName.trim() === "" ? row.clothCode.trim() : row.clothName,
            source: "ShopSupplied" as const,
            color: null,
            quantity: metres,
            // Sent so the cloth comes off stock. The server resolves it against the price list; an
            // unmatched code is kept as typed and simply never reaches inventory.
            clothCode: row.clothCode.trim(),
            unit: "Metres" as const,
          }
        : null;

      // The order API prices an item as quantity x unitPrice and has nowhere to put a separate
      // cloth charge, so the cloth is folded into the unit price rather than being dropped. That
      // keeps the saved total equal to the total on screen and on the invoice — but it does mean
      // the split between cloth and stitching is not stored yet. Recording the two amounts
      // separately is the backend half of this feature.
      const unitPrice = tailoring + clothAmount(row, businessMode) / quantity;

      items.push({ garmentType: row.garmentType, quantity, unitPrice, fabric });
    }

    if (items.length === 0) {
      showToast("Add at least one garment item.", "error");
      return;
    }

    if (!Number.isFinite(advanceValue) || advanceValue < 0) {
      showToast("Advance amount must be zero or greater.", "error");
      return;
    }
    if (advanceValue > orderTotal) {
      showToast("Advance can't be more than the order total.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder(
        {
          customerId: customer.id,
          employeeId: employee?.id ?? null,
          dueAtUtc: new Date(dueAtUtc).toISOString(),
          notes: orderNotes.trim() === "" ? null : orderNotes,
          items,
        },
        getAccessToken(),
      );
      // Invoice generation is now a separate, explicit step (the Generate Invoice button below)
      // rather than automatic — staff review Total/Advance/Balance before committing to it.
      setCreatedOrder(order);
      showToast("Order created.");
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!createdOrder) {
      return;
    }
    setIsGeneratingInvoice(true);
    try {
      // Tax comes from the shop's rate in Invoice Settings, read at click time so this form and the
      // order screen's Generate Invoice always charge the same thing. Discount stays 0 — there is
      // no field for it, and a shop-wide default discount is not a thing a shop wants.
      const { taxRatePercent } = await getInvoiceSettings(getAccessToken()).catch(() => DEFAULT_INVOICE_SETTINGS);
      // Tax is charged on what is actually payable, not on the pre-discount total — a discount that
      // did not reduce the tax would quietly hand part of it back to the taxman.
      const invoice = await createInvoice(
        createdOrder.id,
        taxAmountFor(payableTotal, taxRatePercent),
        safeDiscount,
        getAccessToken(),
      );
      // recordPayment returns the invoice with amountPaid/remainingBalance updated — that's the
      // copy the printable invoice needs, not the pre-payment one from createInvoice.
      const finalInvoice = advanceValue > 0 ? await recordPayment(invoice.id, advanceValue, advanceMethod, getAccessToken()) : invoice;
      showToast("Invoice generated.");
      // Stay on this page instead of navigating away — Generate invoice turns into View Invoice,
      // which opens the printable modal, so staff decide when to leave.
      setCreatedInvoice(finalInvoice);
    } catch (error) {
      // The order itself already exists — don't strand it. Staff can retry Generate Invoice here,
      // or fall back to the order page's own manual "Create Invoice" action.
      showToast(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.", "error");
    } finally {
      setIsGeneratingInvoice(false);
    }
  }

  /**
   * The inline "add a customer without leaving the order" form.
   *
   * Rendered in two places at once for the same reason as the measurement panel below: the second
   * column it lives in from `lg` up becomes the bottom of the page once the layout is one stack, so
   * on a phone this opens directly under the Customer Details card that asked for it. Only one copy
   * is ever visible, but both are in the DOM, so the field ids take a suffix.
   */
  /**
   * The measurement editor for whichever item is open.
   *
   * Rendered in two places at once: in the second column from `lg` up, and inline beneath the item
   * itself below `lg`, where there is no second column to put it in. Only one is ever visible — the
   * other is hidden by a breakpoint, not unmounted — so the notes field takes an id suffix rather
   * than shipping the same id twice and breaking its label.
   */
  function renderMeasurementPanel(idSuffix: string) {
    if (!activeMeasurementItem) {
      return null;
    }
    const notesId = `measurementNotes-${idSuffix}`;
    return (
      <div className="orderSection-measure flex shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <span className="order-heading min-w-0 flex-1 truncate text-base font-semibold">
            Measurement Details — Item {activeMeasurementItemIndex + 1} · {activeMeasurementItem.garmentType}
          </span>
          <button
            type="button"
            onClick={() => setActiveMeasurementItemId(null)}
            className="shrink-0 text-sm text-foreground/70 hover:text-foreground"
          >
            Close
          </button>
        </div>
        {!customer ? (
          <p className="text-sm text-foreground/70">Select a customer to view or add their measurements.</p>
        ) : isLoadingMeasurements || isLoadingTemplate ? (
          <p className="text-sm text-foreground/70">Loading measurements…</p>
        ) : measurementFields.length === 0 ? (
          <p className="text-sm text-foreground/70">No measurement points configured for {activeMeasurementItem.garmentType} yet.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <div className="flex flex-1 flex-col gap-2">
              {measurementFieldsFirstHalf.map((point) => (
                <MeasurementPointInput
                  key={point.name}
                  point={point}
                  value={measurementValues[point.name] ?? ""}
                  disabled={isOrderCreated}
                  onChange={(next) => setMeasurementValues((prev) => ({ ...prev, [point.name]: next }))}
                />
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {measurementFieldsSecondHalf.map((point) => (
                <MeasurementPointInput
                  key={point.name}
                  point={point}
                  value={measurementValues[point.name] ?? ""}
                  disabled={isOrderCreated}
                  onChange={(next) => setMeasurementValues((prev) => ({ ...prev, [point.name]: next }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* The remark that goes with the numbers — "left shoulder sits lower", "loose at
            the waist", "cuff as per the shirt he brought in". It belongs to this
            customer's measurement for this garment, so it comes back on their next order
            for the same thing, which is exactly when a tailor wants to be reminded.

            Shown whenever the panel is showing measurement fields, and saved by the same
            Save button: a note is part of the fitting, not a separate errand. */}
        {customer && !isLoadingMeasurements && !isLoadingTemplate && measurementFields.length > 0 && (
          <div className="flex shrink-0 flex-col gap-1">
            <label htmlFor={notesId} className="text-sm font-medium">
              Notes (optional)
            </label>
            <textarea
              id={notesId}
              rows={2}
              value={measurementNotes}
              maxLength={MEASUREMENT_NOTES_MAX_LENGTH}
              disabled={isOrderCreated}
              onChange={(e) => setMeasurementNotes(e.target.value)}
              placeholder="Anything about the fit the tailor should know…"
              className={fieldClassName}
            />
          </div>
        )}

        {measurementFormError && (
          <p role="alert" className="text-sm text-danger">
            {measurementFormError}
          </p>
        )}

        {customer && !isLoadingMeasurements && measurementFields.length > 0 && (
          <div className="flex justify-end gap-3 border-t border-border pt-3">
            <Button type="button" variant="secondary" onClick={handleClearMeasurement} disabled={isSavingMeasurement || isOrderCreated}>
              Clear
            </Button>
            <Button type="button" onClick={handleSaveMeasurement} disabled={isSavingMeasurement || isOrderCreated}>
              {isSavingMeasurement ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    {/* no-spinner (globals.css): every number field on this screen — quantity, tailoring, metres,
        advance, measurement points — is typed, never stepped, and the arrows were eating width
        from the item rows' five-across layout. */}
    <div className="no-spinner flex flex-col gap-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* text-2xl to match Customers and every other page title. This screen used to run a size
            smaller to buy height for the item list; the columns no longer share one locked
            viewport height, so the pixels are not needed and the odd-one-out heading was the first
            thing that gave away that this page was built to its own rules. */}
        <div>
          <h1 className="text-2xl font-semibold">
            {createdOrder
              ? `Order - ${createdOrder.orderNumber?.trim() || `#${createdOrder.id.slice(0, 8).toUpperCase()}`}`
              : kindMeta.label}
          </h1>
          {/* Whose cloth this is, said once at the top. It is the only thing that separates the
              three screens, and the thing staff were previously working out from which fields
              happened to be on the page. Dropped once the order exists — by then the record says
              what it is, and the line would be describing a decision no longer being made. */}
          {!createdOrder && <p className="mt-0.5 text-sm text-foreground/70">{kindMeta.fabricNote}</p>}
        </div>
        {/* The kind used to be a pair of pills here, and before that a per-shop setting. It is now
            the screen itself, so the only thing left to say is which screen this is — and, while
            the order is still being written, the way back to pick a different one. */}
        <div className="flex items-center gap-4">
          {!isOrderCreated && (
            <Link
              href="/dashboard/orders/new"
              className="text-sm font-medium text-foreground/70 hover:text-foreground"
            >
              Change order type
            </Link>
          )}
          <Link href="/dashboard/orders" className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to orders
          </Link>
        </div>
      </div>

      <form onSubmit={handleCreateOrder} className="flex flex-col gap-4">
        {/* items-start, and no shared height: the two columns are independent stacks of cards that
            each end where their content does. The old lg:h-[min(100dvh,44rem)] pinned both to one
            viewport-height box, which is why the measurement panel needed a frozen height and the
            summary had to be squeezed into a two-across row — the right column now simply grows and
            the page scrolls, like every other screen in the app. */}
        <div className="flex flex-col items-start gap-4 lg:flex-row">
          {/* Column 1: who the order is for, and what's being made — two cards now, because they
              are two things. They shared one card only because the locked column height made a
              second border look like clutter. */}
          {/* Equal halves. Tried at 43/57 and at 60/40, and neither read better than this: the item
              editor's field grids cap at max-w-2xl and stop using width past 672px, so widening this
              side leaves a gap, and narrowing it crowds the five-across item row. Even is the answer
              here — please don't re-derive it. */}
          <div className="flex w-full flex-1 flex-col gap-4 lg:flex-[2]">
          <div className="orderSection-customer flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 className="order-heading text-base font-semibold">Customer Details</h2>
            {/* The Customer field (a second, name/phone search picker) was removed as redundant
                with Mobile Number below — this block now doubles as both the search UI and, once
                a customer is picked, their name/phone display with a Change link back to search. */}
            {!customer ? (
              <div ref={mobileFieldRef} className="relative flex flex-col gap-1">
                <label htmlFor="mobileNumber" className="text-sm font-medium">
                  Search customer
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="mobileNumber"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      setIsMobileDropdownOpen(true);
                    }}
                    onFocus={() => setIsMobileDropdownOpen(true)}
                    placeholder="Search by name or mobile number…"
                    className={`${fieldClassName} min-w-0 flex-1`}
                  />
                  {/* Adding a customer no longer depends on searching for one first. The old route
                      in — type seven digits, get no match, click the row that appears under the
                      dropdown — worked, but only if you already knew it was there, and not at all
                      if you were searching by name. Same handler, just reachable. */}
                  <Button type="button" variant="secondary" onClick={() => startAddingNewCustomer("")}>
                    + New Customer
                  </Button>
                </div>
                {isMobileDropdownOpen && debouncedMobileNumber && mobileMatches.length > 0 && (
                  <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                    {mobileMatches.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => selectCustomer(c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover">
                          {c.fullName} ({toDisplayPhoneNumber(c.phoneNumber)})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {isMobileDropdownOpen && debouncedMobileNumber && mobileMatches.length === 0 && digitsOnly(debouncedMobileNumber).length >= 7 && (
                  <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
                    <button
                      type="button"
                      onClick={() => startAddingNewCustomer(debouncedMobileNumber, "phone")}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
                    >
                      {`+ Add new customer with mobile ${debouncedMobileNumber}`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Selected customer</label>
                {/* The picked customer reads as a filled chip rather than an empty field — it is a
                    decision that has been made, not a box still waiting for one. */}
                <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {customer.fullName} ({toDisplayPhoneNumber(customer.phoneNumber)})
                  </span>
                  {!isOrderCreated && (
                    <button type="button" onClick={clearCustomer} className="shrink-0 font-medium text-primary hover:text-primary-hover">
                      Change
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

            <div ref={itemsAreaRef} className="orderSection-items rounded-lg border border-border bg-surface p-4">
              <OrderItemsEditor
                key={formKey}
                mode={businessMode}
                fabricOnly={isFabricSale}
                tailoringRates={tailoringRates}
                garments={offerableGarments}
                onChange={setItemRows}
                activeItemId={activeMeasurementItemId}
                onItemClick={handleItemClick}
                // Phone-only: the measurement panel opens as the next row down, under the item it
                // was opened from, instead of at the foot of the page where the second column
                // lands once the layout is a single stack. Carries its own card border here
                // because the second column's wrapper is what supplies one on a wide screen.
                renderItemDetail={() => (
                  <div className="flex flex-col gap-3 rounded-lg border border-primary bg-surface p-4">
                    {renderMeasurementPanel("inline")}
                  </div>
                )}
                disabled={isOrderCreated}
              />
            </div>
          </div>

          {/* Right side: a stack of cards — Measurement Details, Order Summary, Payment Details,
              Schedule, Actions — in the order staff work down them.

              This column scrolls on its own from the large breakpoint up, and the left one does
              not. That asymmetry is the point: the item list grows without limit as garments are
              added, so it belongs to the page, while everything on this side has to stay reachable
              while it does — measurements for the item being edited, the running total, and Create
              order at the foot. Sticky keeps the column in view; max-h bounds it to the viewport so
              overflow-y has something to scroll against; and the parent's items-start (rather than
              stretch) is what lets sticky work at all inside a flex row.

              Below lg the two columns are one stack, and an inner scrollbar there would be a second
              scroll region on a phone — so none of this applies. */}
          <div className="flex w-full flex-1 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:flex-[2] lg:overflow-y-auto lg:pr-1">
            {/* Still one box with three modes (measurement, new customer, summary preview), and
                still a minimum height, so opening and closing one does not shunt the cards below it
                up and down the screen. It no longer needs a *frozen* height now that the columns
                are independent — min-h lets a long measurement template grow the card instead of
                scrolling inside a 18rem window. */}
            <div
              ref={measurementBlockRef}
              className={`flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:flex lg:min-h-[18rem] ${
                // Below lg, two of this card's three modes are showing inline where they were asked
                // for instead — measurements under their own item, the new-customer form under
                // Customer Details. Leaving the card rendered would put a second copy of one of
                // them under the item list, or an empty bordered box once both are closed. The
                // Order summary preview has no inline home and still opens here at every width.
                activeMeasurementItem || isAddingNewCustomer ? "hidden" : "flex"
              }`}
            >
              {/* From lg up this is where measurements are edited. Below lg the same panel is
                  rendered inline under its own item instead (see renderItemDetail), and this whole
                  card is hidden — see the wrapper's className. */}
              <div className="hidden lg:contents">{renderMeasurementPanel("column")}</div>
              {/* Clicking the Order summary cell opens an invoice-style preview here instead of
                  just closing whatever was open — a read-only recap of items/total/advance/balance
                  before committing to Create order. */}
              {!activeMeasurementItem && !isAddingNewCustomer && isViewingSummary && (
                <div className="orderSection-summary flex shrink-0 flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="order-heading text-base font-semibold">Order Summary Preview</h2>
                    <button type="button" onClick={() => setSummarySource(null)} className="text-sm text-foreground/70 hover:text-foreground">
                      Close
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-foreground/70">
                        <th className="py-1 font-medium">#</th>
                        <th className="py-1 font-medium">Garment</th>
                        <th className="py-1 text-right font-medium">Qty</th>
                        {businessMode === "tailoringFabric" && <th className="py-1 text-right font-medium">Cloth</th>}
                        <th className="py-1 text-right font-medium">Tailoring</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemRows.map((row, index) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-1">{index + 1}</td>
                          <td className="py-1">{row.garmentType}</td>
                          <td className="py-1 text-right">{row.quantity || "0"}</td>
                          {businessMode === "tailoringFabric" && (
                            <td className="py-1 text-right">{clothAmount(row, businessMode).toFixed(2)}</td>
                          )}
                          <td className="py-1 text-right">{(Number(row.tailoringRate) || 0).toFixed(2)}</td>
                          <td className="py-1 text-right">{itemRowTotal(row).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/70">Total</span>
                      <span className="font-medium">{orderTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/70">Advance</span>
                      <span className="font-medium">{advanceValue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/70">Balance</span>
                      <span className="font-medium">{orderBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              {/* An empty card said nothing about what it was for, so the panel sat blank until
                  someone happened to click an item and discovered it. It now names itself and says
                  what to do — the one instruction on the page that is not obvious from the form. */}
              {!activeMeasurementItem && !isAddingNewCustomer && !isViewingSummary && (
                <div className="orderSection-measure flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <TapeMeasureIcon className="h-8 w-8 text-foreground/25" />
                  <h2 className="order-heading text-base font-semibold">Measurement Details</h2>
                  <p className="max-w-xs text-sm text-foreground/70">
                    Select a customer and a garment item to view or add measurements.
                  </p>
                </div>
              )}
            </div>

            {/* Order Summary. Clicking it opens the itemised preview in the panel above — the
                card is the headline, the preview is the detail behind it. */}
            <div
              ref={orderSummaryRef}
              onClick={() => handleOpenSummary("summary")}
              className={`orderSection-summary flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors ${
                summarySource === "summary" ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <h2 className="order-heading text-base font-semibold">Order Summary</h2>
              {/* What the total is made of, then the total; then what has been paid, then what is
                  left. Two ruled-off figures in blue, because those are the two a customer is told. */}
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-foreground/70">Total Items</dt>
                  <dd className="font-medium tabular-nums">{totalItems}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-foreground/70">Tailoring Total</dt>
                  <dd className="font-medium tabular-nums">{money(tailoringTotal)}</dd>
                </div>
                {businessMode === "tailoringFabric" && (
                  <div className="flex items-center justify-between">
                    <dt className="text-foreground/70">Cloth Total</dt>
                    <dd className="font-medium tabular-nums">{money(clothTotal)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <dt className="font-semibold">Order Total</dt>
                  <dd className="text-base font-semibold tabular-nums text-primary">{money(orderTotal)}</dd>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <dt className="text-foreground/70">Advance Received</dt>
                  <dd className="font-medium tabular-nums">{money(Number.isFinite(advanceValue) ? advanceValue : 0)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <dt className="font-semibold">Balance Due</dt>
                  <dd className="text-base font-semibold tabular-nums text-primary">{money(orderBalance)}</dd>
                </div>
              </dl>
            </div>

            {/* Payment. Its own card rather than a corner of the summary: the advance is something
                staff enter, and the summary is something they read. Mixing the two put two editable
                fields in the middle of a block of figures. */}
            <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <h2 className="order-heading text-base font-semibold">Payment Details</h2>
              <div className="flex flex-col gap-3">
                {/* Label and field on one line. This is a single short figure, not a form section,
                    and stacking it left a full-width label over a box the amount barely fills. The
                    label takes a fixed width so it cannot squeeze the field as the text changes. */}
                {/* Above the advance, because it comes off the bill before anything is paid against
                    it — the balance staff quote is the discounted one, and asking for the advance
                    first would have them quoting a figure that is about to change. */}
                <div className="flex items-center gap-3">
                  <label htmlFor="discountAmount" className="w-36 shrink-0 text-sm font-medium">
                    Discount
                  </label>
                  <input
                    id="discountAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    disabled={isOrderCreated}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${fieldClassName} w-36`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="advanceAmount" className="w-36 shrink-0 text-sm font-medium">
                    Advance Received
                  </label>
                  <input
                    id="advanceAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanceAmount}
                    disabled={isOrderCreated}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${fieldClassName} w-36`}
                  />
                </div>
                {/* Full width beneath the amount rather than squeezed into a second column: four
                    methods side by side need the room, and the order staff work in is amount first,
                    then how it arrived. */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Payment Method</span>
                  <PaymentMethodPicker
                    value={advanceMethod}
                    onChange={setAdvanceMethod}
                    disabled={isOrderCreated}
                    label="Advance payment method"
                  />
                </div>
              </div>
            </div>

            {/* Scheduling. Clicking it opens the same preview as the summary above — the two are
                one review step, and reaching the preview shouldn't depend on which card you click. */}
            <div
              ref={scheduleRef}
              onClick={() => handleOpenSummary("schedule")}
              className={`orderSection-schedule flex w-full cursor-pointer flex-col gap-3 rounded-lg border bg-surface p-4 transition-colors ${
                summarySource === "schedule" ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="dueAtUtc" className="text-sm font-medium">
                  Collection Date
                </label>
                {/* Weekday beside the field, on its line — it answers "is that a Sunday?" right
                    where the date is read, and sharing the row costs no height. The field is given
                    a fixed width and the day one of its own, wide enough for "Wednesday", so
                    neither moves as the date changes.

                    A text field rather than a native date input, because a native one renders in
                    the browser's own locale — mm/dd/yyyy on these machines — and no attribute
                    changes that ("lang" is ignored). The real date input is still there, kept
                    rendered but invisible behind this one, purely so its picker can be opened. */}
                <div className="flex items-center gap-3">
                  <DateInput
                    id="dueAtUtc"
                    value={dueAtUtc}
                    onChange={setDueAtUtc}
                    disabled={isOrderCreated}
                    className="w-32 shrink-0"
                  />
                  {/* Rendered even when blank, so nothing shifts as the date is typed. */}
                  <span className="min-w-[5.5rem] shrink-0 truncate text-sm font-medium text-foreground/70">
                    {collectionWeekday?.label ?? ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="employee" className="text-sm font-medium">
                  Assigned Employee (optional)
                </label>
                {/* The whole roster in one list rather than a search box: a shop has tens of staff,
                    not thousands, and picking from a list beats typing a name you have to spell
                    right. "Not assigned" is the first option and the default — most orders are
                    handed to a tailor later, not at the counter. */}
                <select
                  id="employee"
                  value={employee?.id ?? ""}
                  disabled={isOrderCreated || isLoadingEmployees}
                  onChange={(e) => setEmployee(employees.find((candidate) => candidate.id === e.target.value) ?? null)}
                  className={fieldClassName}
                >
                  <option value="">{isLoadingEmployees ? "Loading employees…" : "Not assigned"}</option>
                  {employees.map((option) => (
                    <option key={option.id} value={option.id}>
                      {/* Code alongside the name — a shop can hold two Kumars. */}
                      {option.fullName}
                      {option.employeeCode ? ` (${option.employeeCode})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="orderNotes" className="text-sm font-medium">
                  Notes (optional)
                </label>
                <textarea
                  id="orderNotes"
                  rows={2}
                  value={orderNotes}
                  disabled={isOrderCreated}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Anything the tailor should know…"
                  className={fieldClassName}
                />
              </div>
            </div>

            {/* Row 3: order creation and (once created) invoice generation, as two explicit steps.
                Takes whatever height is left over so this column ends level with the item list
                beside it — the frozen panel above rounds to a fixed size, and without this the
                slack showed up as a gap under the buttons. */}
            {/* No error text lives in this card. A message appearing here changed its height, and
                with it the height of everything aligned to it — order failures are announced by a
                toast at the page's bottom-right instead, where nothing has to move to make room. */}
            <div className="flex w-full shrink-0 flex-col justify-center gap-3 rounded-lg border border-border bg-surface p-4">
              {/* Wraps — four buttons in a nowrap row have a min-content width of 334px, which no
                  amount of shrinking elsewhere could fit on a 320px phone. That was the page's
                  sideways scroll, not anything in the item list. */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="submit" disabled={isSubmitting || isOrderCreated}>
                  {isSubmitting ? "Creating…" : isOrderCreated ? "Order created" : "Create order"}
                </Button>
                {createdInvoice ? (
                  <>
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
                  </>
                ) : (
                  <Button type="button" onClick={() => setShowInvoiceConfirm(true)} disabled={!isOrderCreated || isGeneratingInvoice}>
                    {isGeneratingInvoice ? "Generating…" : "Generate invoice"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isOrderCreated}
                  onClick={() => createdOrder && router.push(`/dashboard/orders/${createdOrder.id}`)}
                >
                  View order
                </Button>
                {/* Only once there is an invoice to share. Rendered rather than hidden before then
                    so the row does not reshuffle the moment one is generated — the button states
                    its own reason when it cannot go ahead. */}
                {createdOrder && (
                  <ShareViaWhatsAppButton
                    customer={customer}
                    invoice={createdInvoice}
                    order={{ orderNumber: createdOrder.orderNumber, dueAtUtc: createdOrder.dueAtUtc }}
                    shopName={branding.shopName || "Mathilens"}
                    whatsAppApp={branding.whatsAppApp}
                  />
                )}
                <Button type="button" variant="secondary" disabled={!isOrderCreated} onClick={handleStartNewOrder}>
                  New order
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={showInvoiceConfirm}
        title="Generate invoice"
        description={`Generate an invoice for this order now? Total ${orderTotal.toFixed(2)}, advance ${advanceValue.toFixed(2)}, balance ${orderBalance.toFixed(2)}.`}
        confirmLabel="Generate"
        confirmingLabel="Generating…"
        confirmVariant="primary"
        isConfirming={isGeneratingInvoice}
        onConfirm={() => {
          setShowInvoiceConfirm(false);
          handleGenerateInvoice();
        }}
        onCancel={() => setShowInvoiceConfirm(false)}
      />
    </div>

    {/* The same dialog and the same form as Customers › New Customer, rather than this screen's own
        smaller copy of it. That copy asked for three fields, so a customer added at the counter
        arrived with no gender, no religion and no dates — and nothing later prompted for them.
        Whoever is standing there is the one person who can answer, so they get the whole form.

        One dialog, not two: the old inline version was rendered twice, once under the search box for
        phones and once in the second column from lg up, because a panel has to live somewhere in the
        layout. A modal sits above it and needs neither. */}
    <Modal open={isAddingNewCustomer} title="New Customer" onClose={() => setIsAddingNewCustomer(false)}>
      <CustomerForm
        initialValues={newCustomerSeed}
        onCancel={() => setIsAddingNewCustomer(false)}
        onSubmit={async (input) => {
          const created = await createCustomer(input, getAccessToken());
          showToast("Customer created.");
          setIsAddingNewCustomer(false);
          // Straight onto the order they were added for — that is the only reason this dialog was
          // opened from here rather than from Customers.
          selectCustomer(created);
        }}
      />
    </Modal>

    {/* Rendered outside the print:hidden wrapper above so printing the modal doesn't also try
        to print (and hide) the rest of the New Order form behind it. */}
    {showInvoiceModal && createdInvoice && createdOrder && customer && (
      <InvoicePrintModal
        invoice={createdInvoice}
        order={createdOrder}
        customer={customer}
        autoPrint={autoPrintInvoice}
        onClose={() => setShowInvoiceModal(false)}
      />
    )}
    </>
  );
}
