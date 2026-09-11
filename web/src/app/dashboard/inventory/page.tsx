"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import { listAllClothPrices, type ClothPrice } from "@/lib/api/clothPrices";
import { searchClothReceipts, receiveCloth, CLOTH_UNITS, type ClothReceipt, type ClothUnit } from "@/lib/api/inventory";
import { DateInput } from "@/components/ui/DateInput";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** yyyy-MM-dd off the local calendar — a delivery lands on a day in the shop, not a UTC instant. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString();
}

/**
 * The log of cloth arriving at the shop.
 *
 * A record of deliveries, not a stock balance: nothing here is netted off when an order uses
 * cloth, because orders do not record which cloth code they consumed. This is what the shop
 * reconciles against supplier bills.
 */
export default function InventoryPage() {
  const { showToast } = useToast();
  const { can, isLoaded } = usePermissions();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [receipts, setReceipts] = useState<ClothReceipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showReceive, setShowReceive] = useState(false);
  // The whole catalogue, loaded once — the field is a dropdown, so every code has to be present
  // rather than fetched as the user types.
  const [clothPrices, setClothPrices] = useState<ClothPrice[]>([]);
  const [isLoadingClothPrices, setIsLoadingClothPrices] = useState(true);
  const [cloth, setCloth] = useState<ClothPrice | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<ClothUnit>("Metres");
  const [receivedOn, setReceivedOn] = useState(todayIsoDate);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canManage = can(PERMISSIONS.inventoryCreate);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchClothReceipts(
        { search: debouncedSearch, from: fromDate, to: toDate },
        page,
        pageSize,
        getAccessToken(),
      );
      setReceipts(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load the cloth receipts.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, fromDate, toDate, page, pageSize]);

  const loadClothPrices = useCallback(async () => {
    setIsLoadingClothPrices(true);
    try {
      setClothPrices(await listAllClothPrices(getAccessToken()));
    } catch {
      // The receipts list is still worth showing; the dropdown reports its own empty state.
      setClothPrices([]);
    } finally {
      setIsLoadingClothPrices(false);
    }
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClothPrices();
  }, [loadClothPrices]);

  function resetForm() {
    setCloth(null);
    setQuantity("");
    setUnit("Metres");
    setReceivedOn(todayIsoDate());
    setSupplierName("");
    setInvoiceNumber("");
    setRatePerUnit("");
    setNotes("");
    setFormError(null);
  }

  async function handleReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!cloth) {
      setFormError("Choose the cloth that was received.");
      return;
    }

    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }

    // Rate is optional — the bill often arrives after the cloth does.
    const rateValue = ratePerUnit.trim() === "" ? null : Number(ratePerUnit);
    if (rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0)) {
      setFormError("Rate cannot be negative.");
      return;
    }

    setIsSaving(true);
    try {
      await receiveCloth(
        {
          clothPriceId: cloth.id,
          quantity: quantityValue,
          unit,
          receivedOn,
          supplierName: supplierName.trim() === "" ? null : supplierName.trim(),
          invoiceNumber: invoiceNumber.trim() === "" ? null : invoiceNumber.trim(),
          ratePerUnit: rateValue,
          notes: notes.trim() === "" ? null : notes.trim(),
        },
        getAccessToken(),
      );
      showToast(`Received ${quantityValue} ${unit.toLowerCase()} of ${cloth.clothCode}.`);
      resetForm();
      setShowReceive(false);
      setPage(1);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to record this receipt.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Transaction</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Cloth received into the shop — what arrived, from whom, and what it cost.
          </p>
        </div>
        {canManage && !showReceive && (
          <Button type="button" onClick={() => setShowReceive(true)}>
            Receive Cloth
          </Button>
        )}
      </div>

      {showReceive && (
        <form onSubmit={handleReceive} className="flex max-w-3xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Receive Cloth</h2>

          {/* Chosen from the price list, never typed: the same cloth recorded under two spellings
              would never reconcile against a supplier bill. */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cloth" className="text-sm font-medium">
              Cloth
            </label>
            <select
              id="cloth"
              value={cloth?.id ?? ""}
              onChange={(e) => setCloth(clothPrices.find((c) => c.id === e.target.value) ?? null)}
              disabled={isLoadingClothPrices || clothPrices.length === 0}
              className={fieldClassName}
            >
              <option value="">
                {isLoadingClothPrices ? "Loading cloth codes…" : "Select cloth…"}
              </option>
              {clothPrices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.clothCode} — {option.clothName}
                </option>
              ))}
            </select>
            {!isLoadingClothPrices && clothPrices.length === 0 && (
              <p className="text-sm text-foreground/60">
                No cloth codes yet — add them on the Fabric Details screen first.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="quantity"
              label="Quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="unit" className="text-sm font-medium">
                Unit
              </label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as ClothUnit)} className={fieldClassName}>
                {CLOTH_UNITS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="receivedOn" className="text-sm font-medium">
                Received on
              </label>
              <DateInput id="receivedOn" value={receivedOn} onChange={setReceivedOn} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input id="supplierName" label="Supplier" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Input
              id="invoiceNumber"
              label="Bill / invoice no."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
            <Input
              id="ratePerUnit"
              label="Rate per unit"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional"
              value={ratePerUnit}
              onChange={(e) => setRatePerUnit(e.target.value)}
            />
          </div>

          <Textarea id="notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowReceive(false);
              }}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Record receipt"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <Input
            id="search"
            label="Search by cloth, supplier or bill no."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search receipts…"
            autoCapitalize="none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fromDate" className="text-sm font-medium">
            From
          </label>
          <DateInput
            id="fromDate"
            value={fromDate}
            max={toDate || undefined}
            onChange={(iso) => {
              setFromDate(iso);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="toDate" className="text-sm font-medium">
            To
          </label>
          <DateInput
            id="toDate"
            value={toDate}
            min={fromDate || undefined}
            onChange={(iso) => {
              setToDate(iso);
              setPage(1);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : receipts.length === 0 ? (
        <p className="text-sm text-foreground/70">No cloth receipts recorded yet.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Cloth</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Bill no.</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-border last:border-0">
                  <td data-label="Received" className="px-4 py-3 whitespace-nowrap">{formatDate(receipt.receivedOn)}</td>
                  <td data-label="Cloth" className="px-4 py-3">
                    <span className="font-mono">{receipt.clothCode}</span>
                    <span className="text-foreground/60"> — {receipt.clothName}</span>
                  </td>
                  <td data-label="Quantity" className="px-4 py-3 whitespace-nowrap">
                    {receipt.quantity.toFixed(2)} {receipt.unit.toLowerCase()}
                  </td>
                  <td data-label="Supplier" className="px-4 py-3">{receipt.supplierName ?? "—"}</td>
                  <td data-label="Bill no." className="px-4 py-3">{receipt.invoiceNumber ?? "—"}</td>
                  <td data-label="Rate" className="px-4 py-3 whitespace-nowrap">{receipt.ratePerUnit?.toFixed(2) ?? "—"}</td>
                  <td data-label="Total" className="px-4 py-3 whitespace-nowrap">{receipt.totalCost?.toFixed(2) ?? "—"}</td>
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
