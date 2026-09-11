"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { GARMENT_TYPES, type GarmentType } from "@/lib/api/measurements";
import { searchClothPrices, type ClothPrice } from "@/lib/api/clothPrices";
import { getAccessToken } from "@/lib/auth";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { TailoringRates } from "@/lib/api/tailoring-rates";
import type { Garment } from "@/lib/api/garments";
import type { BusinessMode } from "@/lib/api/business-mode";

/**
 * What the shop is selling — now a shop-wide setting (Settings › Business Mode) rather than a
 * choice made per order. Re-exported here because the row helpers below are typed on it.
 */
export type { BusinessMode };

/** Whose cloth the garment is cut from — the shop's own roll, or one the customer walked in with. */
export type FabricSourceMode = "internal" | "external";

export type ItemRow = {
  id: number;
  garmentType: GarmentType;
  quantity: string;
  /** What the shop charges to stitch one of these. */
  tailoringRate: string;
  fabricSource: FabricSourceMode;
  /** From the Fabric Details catalog; free text is still allowed for cloth not yet in it. */
  clothCode: string;
  /** Carried so the order can name the cloth, not just its code. */
  clothName: string;
  metres: string;
  /** The catalog's selling price per metre, filled in when a cloth code is picked. */
  ratePerMetre: string;
};

/**
 * One lakh garments on a line — far past any real order, which is the point: it is the wall a
 * typo hits, not a limit anyone should reach. Mirrors `OrderLimits.MaxItemQuantity` on the server,
 * which rejects anything above it; this only saves the round trip.
 */
export const MAX_ITEM_QUANTITY = 100_000;

let nextItemRowId = 0;

function emptyRow(garmentType: GarmentType = GARMENT_TYPES[0]): ItemRow {
  return {
    id: nextItemRowId++,
    garmentType,
    quantity: "1",
    tailoringRate: "",
    // The customer's own cloth is the default, and the first of the two choices. It is the case
    // that needs nothing else filled in, so a row starts complete and only asks for a cloth code
    // once someone says the shop is supplying the fabric.
    fabricSource: "external",
    clothCode: "",
    clothName: "",
    metres: "",
    ratePerMetre: "",
  };
}

const fieldClassName =
  "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50";

/** A figure the row works out, not one anybody types: no field chrome, and it does not take focus. */
const readOnlyFieldClassName =
  "w-full cursor-default rounded-md border border-transparent bg-transparent px-0 py-1.5 text-sm tabular-nums";

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * What the shop's own cloth on this row comes to.
 *
 * Zero for a customer's own fabric, and zero in a tailoring-only order — a shop that does not sell
 * cloth has no cloth to charge for.
 */
export function clothAmount(row: ItemRow, mode: BusinessMode): number {
  if (mode !== "tailoringFabric" || row.fabricSource !== "internal") {
    return 0;
  }
  return toNumber(row.metres) * toNumber(row.ratePerMetre);
}

/**
 * Cloth plus stitching.
 *
 * Live preview only — tolerant of blank and partial input so the total moves as the owner types,
 * unlike the New Order page's strict per-item validation, which runs at submit time.
 */
export function rowTotal(row: ItemRow, mode: BusinessMode): number {
  return clothAmount(row, mode) + toNumber(row.quantity) * toNumber(row.tailoringRate);
}

type ClothCodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectMatch: (match: ClothPrice) => void;
  disabled?: boolean;
};

/** Cloth code picker with search — sourced from the Fabric Details catalog. Opening it (focus/click)
 * lists the catalog even with an empty query; typing filters it live. Picking an entry fills in its
 * code and its Selling price per metre (never Cost price, which is for the shop's own margin
 * tracking, not a customer-facing order). Free text is still allowed for cloth not yet in the
 * catalog — but then nobody has said what a metre of it costs, so the rate stays for the operator
 * to fill in. */
function ClothCodeField({ value, onChange, onSelectMatch, disabled = false }: ClothCodeFieldProps) {
  const debouncedValue = useDebouncedValue(value, 300);
  const [matches, setMatches] = useState<ClothPrice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Nothing to search for a field that cannot be typed in. This field is now rendered on every
    // item row rather than only the shop-fabric ones, so without this a four-item order asked the
    // price list for a catalogue four times over on load, for four fields nobody can use.
    if (disabled) {
      return;
    }

    let cancelled = false;
    searchClothPrices(debouncedValue, 1, 8, getAccessToken())
      .then(({ items }) => {
        if (!cancelled) {
          setMatches(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue, disabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Same outside-click-closes pattern used by the Mobile Number dropdown on the New Order page.
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  function selectMatch(match: ClothPrice) {
    onSelectMatch(match);
    setIsOpen(false);
  }

  return (
    <div ref={fieldRef} className="relative flex flex-col gap-0.5">
      <label className="text-xs text-foreground/70">Cloth Code</label>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className={fieldClassName}
      />
      {!disabled && isOpen && matches.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 max-h-40 w-full min-w-[10rem] overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {matches.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                onClick={() => selectMatch(match)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-hover"
              >
                {match.clothCode} — {match.clothName} <span className="text-foreground/60">({match.sellingPrice.toFixed(2)})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type OrderItemsEditorProps = {
  onChange: (rows: ItemRow[]) => void;
  mode: BusinessMode;
  /** The shop's price list (Settings › Tailoring Cost). Fills a row's Tailoring amount in. */
  tailoringRates: TailoringRates;
  /**
   * Cloth only, with nothing being stitched.
   *
   * Hides the garment, quantity and stitching-cost fields, because on a counter sale none of them
   * has an answer: there is no garment, the length is the metres below, and nobody is stitching.
   * Leaving a Tailoring Cost box on screen that the sale then ignores would invite an amount that
   * silently never reaches the bill.
   */
  fabricOnly?: boolean;
  /**
   * The garments this order may be for: on the shop's list (Settings › Garments) and priced.
   *
   * Empty until both have loaded, so the dropdown is never briefly offering garments that are about
   * to disappear from it.
   */
  garments: Garment[];
  activeItemId?: number | null;
  onItemClick?: (row: ItemRow) => void;
  /**
   * Rendered directly beneath the active row, below the `lg` breakpoint only — the measurement
   * panel, in practice.
   *
   * On a wide screen the panel lives in the page's second column, beside the item it belongs to.
   * A phone has no second column: that stack sits below every item, so tapping Item 2 scrolled the
   * answer off-screen and the connection between the row and its measurements was lost. Here the
   * panel opens where it was asked for, as row 2 of 4 rather than at the foot of the page.
   */
  renderItemDetail?: (row: ItemRow) => ReactNode;
  /** Freezes every field and the Add item/Remove buttons — used once an order has been created from this form. */
  disabled?: boolean;
};

/** Dynamic garment-line editor for the create-order form. In a tailoring-and-fabric order each
 * line also says whose cloth the garment is cut from, and prices the shop's own. */
export function OrderItemsEditor({ onChange, mode, tailoringRates, garments, activeItemId, onItemClick, renderItemDetail, disabled = false, fabricOnly = false }: OrderItemsEditorProps) {
  // Two rows to start — a shirt and a trousers is the order a counter takes most often, and a
  // third empty row was one more thing to look past. "+ Add item" covers the rest.
  const [rows, setRows] = useState<ItemRow[]>(() => [emptyRow("Shirt"), emptyRow("Trousers")]);

  useEffect(() => {
    // The default rows only live in this component's own state until the parent is told about
    // them — without this, clicking an item before editing any field finds nothing in the
    // parent's copy, since onChange is otherwise only called from update() below. Deliberately
    // mount-only: update() below owns every subsequent change, so onChange/rows aren't deps here.
    onChange(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The price list and the garment list both arrive a moment after the form does, so the rows
    // already on screen are settled when they land: any row standing on a garment the shop does
    // not offer moves to one it does, and a blank amount is filled from the price list. A typed
    // amount is left alone — it is the operator's decision and outranks the list.
    if (garments.length === 0) {
      return;
    }
    const fallback = garments[0].name;
    const settled = rows.map((row) => {
      const garmentType = garments.some((g) => g.name === row.garmentType) ? row.garmentType : fallback;
      const movedGarment = garmentType !== row.garmentType;
      if (!movedGarment && row.tailoringRate.trim() !== "") {
        return row;
      }
      // A row pushed onto a different garment takes that garment's price, not the old one's.
      return { ...row, garmentType, tailoringRate: movedGarment ? rateFor(garmentType) : rateFor(row.garmentType) };
    });
    if (settled.some((row, index) => row !== rows[index])) {
      update(settled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailoringRates, garments]);

  function update(next: ItemRow[]) {
    setRows(next);
    onChange(next);
  }

  function updateRow(id: number, patch: Partial<ItemRow>) {
    update(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  /** The shop's price for a garment, as the field holds it — blank when nobody has set one. */
  function rateFor(garmentType: GarmentType): string {
    const rate = tailoringRates[garmentType];
    return rate === undefined ? "" : String(rate);
  }

  function addRow() {
    const row = emptyRow(garments[0]?.name);
    update([...rows, { ...row, tailoringRate: rateFor(row.garmentType) }]);
  }

  function removeRow(id: number) {
    update(rows.filter((row) => row.id !== id));
  }

  const sellsFabric = mode === "tailoringFabric";

  // Nothing can be ordered until a garment is both listed and priced, so say which of the two is
  // missing rather than showing rows whose Garment dropdown is empty.
  if (garments.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <span className="order-heading shrink-0 text-sm font-medium">Garment items</span>
        <p className="rounded-md border border-border p-3 text-sm text-foreground/70">
          No garment has a stitching price yet. Add one under Settings &rsaquo; Garments and price it under Settings
          &rsaquo; Tailoring Cost, and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <span className="order-heading shrink-0 text-sm font-medium">Garment items</span>
      {rows.map((row, index) => {
        // Whether this row's cloth is the shop's — what decides if the cloth fields below take
        // input, and the same condition the New Order page validates and prices the row on.
        const usesShopFabric = row.fabricSource === "internal";
        return (
        <Fragment key={row.id}>
        <div
          onClick={() => onItemClick?.(row)}
          className={`flex shrink-0 flex-col gap-2 rounded-lg border bg-surface p-3 transition-colors ${
            onItemClick ? "cursor-pointer" : ""
          } ${activeItemId === row.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
        >
          {/* Wraps below sm, where the three parts do not fit on one line: the fabric toggle alone
              is around 190px of a 360px phone. Item N keeps the left, Remove keeps the right, and
              the toggle drops to a full-width line of its own beneath them. From sm up the toggle
              is pulled back onto the title's line (sm:ml-auto) and Remove sits beside it — which is
              the layout this row has always had on a desktop. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium">Item {index + 1}</span>
              {/* Whose cloth, right in the item's header — it decides whether the row carries a
                  cloth charge at all, so it belongs above the fields it governs, not among them. */}
              {sellsFabric && (
                <div className="order-last inline-flex w-full items-center rounded-md border border-border bg-surface p-0.5 sm:order-none sm:ml-auto sm:w-auto" onClick={(e) => e.stopPropagation()}>
                  {(
                    [
                      { value: "external", label: "Customer fabric" },
                      { value: "internal", label: "Shop fabric" },
                    ] as const
                  ).map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      disabled={disabled}
                      aria-pressed={row.fabricSource === choice.value}
                      onClick={() => updateRow(row.id, { fabricSource: choice.value })}
                      className={`flex-1 rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${
                        row.fabricSource === choice.value
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/70 hover:bg-surface-hover hover:text-foreground"
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
              {rows.length > 1 && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRow(row.id);
                  }}
                  // ml-auto holds Remove at the right edge on its own; from sm up the toggle beside
                  // it has taken over that job, so it drops back to sitting next to it.
                  className={`ml-auto text-sm text-danger hover:text-danger-hover ${sellsFabric ? "sm:ml-0" : ""}`}
                >
                  Remove
                </button>
              )}
          </div>

          {/* No stopPropagation here — a click anywhere in the fields (including a blank input)
              should still bubble up and open the measurement panel for this item, same as
              clicking the card itself. Only Remove and the fabric choice opt out. */}
          {/* One field per line on a phone. Two-across put a 160px box under a label like
              "Tailoring Cost", which is narrow enough that the amount and its heading stop reading
              as a pair; from sm up the five-across row is unchanged. */}
          <div className={`grid max-w-2xl grid-cols-1 gap-x-3 gap-y-2 ${fabricOnly ? "sm:grid-cols-2" : sellsFabric ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
            {!fabricOnly && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-foreground/70">Garment</label>
              <select
                value={row.garmentType}
                disabled={disabled}
                // Changing the garment re-prices the row from the shop's list — that is what the
                // list is for. A garment with no set price clears the amount rather than leaving
                // the previous garment's, which would be quietly wrong.
                onChange={(e) => {
                  const garmentType = e.target.value as GarmentType;
                  updateRow(row.id, { garmentType, tailoringRate: rateFor(garmentType) });
                }}
                className={fieldClassName}
              >
                {/* Only garments the shop lists and has priced. A garment with no price would put
                    a zero on the bill, so it is not offered at all rather than offered and blank. */}
                {garments.map(({ name }) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            )}
            {!fabricOnly && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-foreground/70">Quantity</label>
              <input
                type="number"
                min="1"
                max={MAX_ITEM_QUANTITY}
                value={row.quantity}
                disabled={disabled}
                onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                className={fieldClassName}
              />
            </div>
            )}
            {!fabricOnly && (
            <div className="flex flex-col gap-0.5">
              {/* Named for what it is. "Unit price" said nothing about which of the two amounts on
                  a fabric order it was. */}
              <label className="text-xs text-foreground/70">Tailoring Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.tailoringRate}
                disabled={disabled}
                onChange={(e) => updateRow(row.id, { tailoringRate: e.target.value })}
                className={fieldClassName}
              />
            </div>
            )}
            {/* Cloth Cost sits beside Tailoring rather than only down in the fabric block, so the
                two halves of the price are read together and the Item Total below them adds up in
                plain sight. Shown only when the shop sells cloth — otherwise there is no second
                half. Its value is the same clothAmount the totals use; nothing is recalculated. */}
            {sellsFabric && (
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-foreground/70">Cloth Cost</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={clothAmount(row, mode).toFixed(2)}
                  className={readOnlyFieldClassName}
                />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-foreground/70">Item Total</label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={rowTotal(row, mode).toFixed(2)}
                className={`${readOnlyFieldClassName} font-semibold text-primary`}
              />
            </div>
          </div>

          {/* Only the shop's own cloth is priced — a customer's fabric needs no code, no metres and
              no rate, because the shop is being paid to stitch it and nothing more.

              The block is rendered for both choices rather than only for shop fabric, and locked
              when the cloth is the customer's. Removing it outright made the row change height on
              every toggle, so the item below jumped and the fields moved out from under the cursor;
              this way the row is the same shape whichever choice is showing, and which fields are
              live is the only thing that changes.

              Set off by a hairline rather than by being a filled, padded box inside the card. The
              nested box cost sixteen vertical pixels a row and read as a card within a card, which
              is a lot of weight for four fields already grouped by sitting together. */}
          {sellsFabric && (
            <div className="grid max-w-2xl grid-cols-1 gap-x-3 gap-y-2 border-t border-border pt-2 sm:grid-cols-4">
              <ClothCodeField
                value={row.clothCode}
                onChange={(clothCode) => updateRow(row.id, { clothCode })}
                onSelectMatch={(match) =>
                  updateRow(row.id, {
                    clothCode: match.clothCode,
                    clothName: match.clothName,
                    ratePerMetre: String(match.sellingPrice),
                  })
                }
                disabled={disabled || !usesShopFabric}
              />
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-foreground/70">Metres</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={row.metres}
                  disabled={disabled || !usesShopFabric}
                  onChange={(e) => updateRow(row.id, { metres: e.target.value })}
                  className={fieldClassName}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-foreground/70">Rate / m</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  disabled={disabled || !usesShopFabric}
                  value={row.ratePerMetre === "" ? "" : toNumber(row.ratePerMetre).toFixed(2)}
                  placeholder="Pick a cloth code"
                  className={`${readOnlyFieldClassName} disabled:cursor-not-allowed disabled:opacity-50`}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-foreground/70">Cloth Amount</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  disabled={disabled || !usesShopFabric}
                  value={clothAmount(row, mode).toFixed(2)}
                  className={`${readOnlyFieldClassName} disabled:cursor-not-allowed disabled:opacity-50`}
                />
              </div>
            </div>
          )}
        </div>
        {/* Row 2 of the list on a phone: the open item's measurements, directly under the item they
            belong to. A sibling of the card rather than a child, so a click inside it does not
            bubble back into the card's own open-this-item handler. */}
        {activeItemId === row.id && renderItemDetail && (
          <div className="lg:hidden">{renderItemDetail(row)}</div>
        )}
        </Fragment>
        );
      })}
      {!disabled && (
        <button type="button" onClick={addRow} className="order-add-item self-start text-sm font-medium text-foreground/70 hover:text-foreground">
          + Add item
        </button>
      )}
    </div>
  );
}
