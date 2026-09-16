"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GARMENT_TYPES, type GarmentType } from "@/lib/api/measurements";
import { listAllClothPrices, type ClothPrice } from "@/lib/api/clothPrices";
import { getAccessToken } from "@/lib/auth";
import type { TailoringRates } from "@/lib/api/tailoring-rates";
import type { Garment } from "@/lib/api/garments";
import type { BusinessMode } from "@/lib/api/business-mode";
import type { FabricSourceMode } from "@/lib/orders/order-kind";
import { QuarterNumberInput } from "@/components/ui/QuarterNumberInput";
import { useOrderEntrySettings } from "@/lib/use-order-entry-settings";

/**
 * What the shop is selling — now a shop-wide setting (Settings › Business Mode) rather than a
 * choice made per order. Re-exported here because the row helpers below are typed on it.
 */
export type { BusinessMode };

/**
 * Whose cloth the garment is cut from. Declared in `@/lib/orders/order-kind` beside the rule for
 * which of the two a given order kind starts on, and re-exported here because the row helpers
 * below are typed on it.
 */
export type { FabricSourceMode };

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

function emptyRow(
  garmentType: GarmentType = GARMENT_TYPES[0],
  // Whose cloth, passed in by the screen rather than decided here — see DEFAULT_FABRIC_SOURCE in
  // @/lib/orders/order-kind, which is where the shop-wide answer lives. External remains the
  // fallback for a caller that says nothing, because it is the case that needs no other field
  // filled in and so cannot leave a row incomplete.
  fabricSource: FabricSourceMode = "external",
): ItemRow {
  return {
    id: nextItemRowId++,
    garmentType,
    quantity: "1",
    tailoringRate: "",
    fabricSource,
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
  /**
   * The whole catalogue, fetched once by the editor above rather than by each field.
   *
   * Passed in for two reasons. One request instead of one per row — the previous version searched
   * from inside every field, so a four-item order asked the price list for a catalogue four times
   * over. And the list is complete, so filtering is a local operation: no request per keystroke, no
   * debounce, and no page size to be quietly truncated by.
   */
  catalogue: ClothPrice[];
  disabled?: boolean;
};

/** Cloth code picker with search — sourced from the Fabric Details catalog. Opening it (focus/click)
 * lists the catalog even with an empty query; typing filters it live. Picking an entry fills in its
 * code and its Selling price per metre (never Cost price, which is for the shop's own margin
 * tracking, not a customer-facing order). Free text is still allowed for cloth not yet in the
 * catalog — but then nobody has said what a metre of it costs, so the rate stays for the operator
 * to fill in. */
function ClothCodeField({ value, onChange, onSelectMatch, catalogue, disabled = false }: ClothCodeFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  /**
   * The catalogue narrowed by what has been typed — every match, not a page of them.
   *
   * Local, because the whole list is already here. That removes the two things the previous
   * server-search version could not fix: a page size, which showed eight of fifty-four codes and
   * then a hundred of them; and the 300ms debounce, which is only worth paying when the answer has
   * to cross the network. The list now narrows on the keystroke.
   *
   * Code and name both, since a shop searches for "Cotton" as readily as for "CTN-01".
   */
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query === "") {
      return catalogue;
    }
    return catalogue.filter(
      (cloth) =>
        cloth.clothCode.toLowerCase().includes(query) || cloth.clothName.toLowerCase().includes(query),
    );
  }, [catalogue, value]);

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
        // max-h-64 rather than max-h-40: this lists the catalogue, so about a dozen rows visible at
        // a time beats six. It is still bounded and still scrolls — an unbounded list would run off
        // the bottom of the item row and cover the fields underneath it.
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full min-w-[10rem] overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
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
  /** Opens a row's detail panel. Called by the card itself, so it must not toggle — see onItemClose. */
  onItemClick?: (row: ItemRow) => void;
  /**
   * Closes whichever detail panel is open.
   *
   * <p>Separate from <see cref="onItemClick"/> because the two are pressed by different things. The
   * whole card carries onItemClick, and not every field inside stops the click bubbling — so if
   * that opened and closed by turns, tapping a quantity on an expanded row would collapse the panel
   * beneath it. Only the expand control closes, and it is a button that knows it was pressed.</p>
   */
  onItemClose?: () => void;
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
  /**
   * Which of the two the fabric toggle starts on, for rows this editor creates itself — the two it
   * opens with, and every one added afterwards.
   *
   * Passed in rather than worked out here: the answer belongs to the order kind, and the editor is
   * given `mode` and `fabricOnly` but never the kind itself. Defaults to the customer's own cloth,
   * which is what every caller got before this existed.
   */
  defaultFabricSource?: FabricSourceMode;
  /**
   * Rows to open on, for a form resumed from a draft. Null or omitted starts on the usual two.
   *
   * <p>Read once, when this component mounts — the rows are its own state from then on. A resumed
   * order therefore has to remount the editor rather than merely pass different rows, which the New
   * Order screen does by bumping its form key. Reacting to later changes instead would mean a
   * draft's saved rows could overwrite what somebody had since typed.</p>
   */
  initialRows?: ItemRow[] | null;
  /**
   * The garments this screen's rows open on, in order.
   *
   * <p>Passed in rather than read here, because it is per order kind and the editor is not told
   * which kind it is serving — the New Order screen knows, and hands over the answer.</p>
   */
  defaultGarments?: readonly string[];
};

/** Dynamic garment-line editor for the create-order form. In a tailoring-and-fabric order each
 * line also says whose cloth the garment is cut from, and prices the shop's own. */
export function OrderItemsEditor({ onChange, mode, tailoringRates, garments, activeItemId, onItemClick, onItemClose, renderItemDetail, disabled = false, fabricOnly = false, defaultFabricSource = "external", initialRows = null, defaultGarments }: OrderItemsEditorProps) {
  // Two rows to start — a shirt and a trousers is the order a counter takes most often, and a
  // third empty row was one more thing to look past. "+ Add item" covers the rest.
  //
  // Lazy initialiser, so the opening rows take whichever fabric source the screen asked for at
  // mount. It is not a dependency of anything below: changing the default later would silently
  // rewrite rows the counter had already set by hand.
  const [rows, setRows] = useState<ItemRow[]>(() => {
    // A resumed draft brings its own rows. Re-keyed on the way in: ids are handed out by a module
    // counter that restarts with the page, so rows restored from a draft written in an earlier
    // session can collide with ids this counter is about to issue — two rows sharing an id makes
    // editing one edit both.
    if (initialRows !== null && initialRows.length > 0) {
      return initialRows.map((row) => ({ ...row, id: nextItemRowId++ }));
    }
    return [emptyRow("Shirt", defaultFabricSource), emptyRow("Trousers", defaultFabricSource)];
  });

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

    // A counter sale has no stitching, so its rows must not take a stitching price. Filling this
    // from the shop's list is what put a tailoring charge into a fabric sale's Item Total — cloth,
    // plus a figure for work nobody is doing. The sale's own submit path ignores the field; this
    // stops it reaching the screen as well.
    if (fabricOnly) {
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

  /**
   * Set once somebody has actually changed a row — edited a field, added one, removed one.
   *
   * <p>A ref rather than state: nothing renders differently because of it, and it is read by an
   * effect that must see the current value rather than the one captured when it was created.</p>
   *
   * <p>Deliberately not set by `update` itself. The settling effect above calls update to fill
   * prices from the shop's list, and that is the app tidying up rather than a person editing — if
   * it counted, the default rows would be frozen before the settings had even arrived.</p>
   */
  const hasEditedRows = useRef(false);

  /** Every change a person makes goes through here, so the flag is set in exactly one place. */
  function updateEdited(next: ItemRow[]) {
    hasEditedRows.current = true;
    update(next);
  }

  function updateRow(id: number, patch: Partial<ItemRow>) {
    updateEdited(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  /** The shop's price for a garment, as the field holds it — blank when nobody has set one. */
  function rateFor(garmentType: GarmentType): string {
    const rate = tailoringRates[garmentType];
    return rate === undefined ? "" : String(rate);
  }

  function addRow() {
    const row = emptyRow(garments[0]?.name, defaultFabricSource);
    updateEdited([...rows, { ...row, tailoringRate: rateFor(row.garmentType) }]);
  }

  function removeRow(id: number) {
    updateEdited(rows.filter((row) => row.id !== id));
  }

  const sellsFabric = mode === "tailoringFabric";

  /**
   * The fabric catalogue, read once for the whole form.
   *
   * Here rather than inside each Cloth Code field: there is one of those per item row, so fetching
   * from inside them meant a four-item order pulled the catalogue four times. Read whole rather
   * than a page at a time because this feeds a picker that lists it — listAllClothPrices walks the
   * pages itself, the API capping a page at 100.
   *
   * Only where the shop sells cloth. A tailoring-only order has no fabric fields to fill, so the
   * request would be answered into a form with nowhere to put it.
   */
  const [clothCatalogue, setClothCatalogue] = useState<ClothPrice[]>([]);

  /**
   * What the Quantity and Metres pads offer, from Settings › Order Entry.
   *
   * <p>The shared hook rather than a fetch of its own: the measurement fields on this same screen
   * need the same settings, and this way the whole New Order page reads them once. It starts on the
   * defaults, so the pads work from the first render rather than appearing a moment later.</p>
   */
  const padRanges = useOrderEntrySettings();

  useEffect(() => {
    /*
      The opening rows, once Settings › Order Entry has been read.

      The rows have to exist before this lands — the editor renders immediately and the settings are
      a request — so it opens on the built-in shirt and trousers and is rebuilt here if the shop has
      chosen otherwise.

      Only while nothing has been touched. hasEditedRows is set by every real edit, so a slow
      settings response can never arrive after somebody has started typing and throw their work
      away. A resumed draft counts as touched for the same reason: its rows are the order, not a
      starting point to be replaced.
    */
    if (hasEditedRows.current || initialRows !== null) {
      return;
    }

    // Undefined means the caller has not said, which is not the same as an empty list: an empty
    // list is a shop choosing to open with no rows, and must be honoured.
    if (defaultGarments === undefined) {
      return;
    }

    const wanted = defaultGarments;
    const sameAsNow =
      wanted.length === rows.length && wanted.every((name, i) => name === rows[i]?.garmentType);
    if (sameAsNow) {
      return;
    }

    update(wanted.map((garmentType) => emptyRow(garmentType, defaultFabricSource)));
    // rows/update are deliberately absent: this reacts to the setting arriving, and re-running it
    // on every row change is precisely what it must not do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultGarments]);

  useEffect(() => {
    if (!sellsFabric) {
      return;
    }

    let cancelled = false;
    listAllClothPrices(getAccessToken())
      .then((all) => {
        if (!cancelled) {
          setClothCatalogue(all);
        }
      })
      // Left empty on failure, which leaves the picker listing nothing while the field itself still
      // takes free text — a cloth code can always be typed, so a catalogue that will not load costs
      // convenience rather than the ability to write the order.
      .catch(() => {
        if (!cancelled) {
          setClothCatalogue([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sellsFabric]);

  /**
   * Whether the row asks whose cloth this is.
   *
   * Only where the question has two answers. A fabric-only order is the shop selling a length over
   * the counter — there is no garment, no stitching and nothing of the customer's involved, so
   * "Customer fabric" is not a choice being declined, it is a choice that does not exist. Offering
   * it invited a selection that would empty the cloth fields the sale is entirely made of.
   *
   * Distinct from `sellsFabric`, which still governs the cloth code, metres, rate and Cloth Cost —
   * a fabric-only order needs every one of those, and needs them more than any other kind does.
   */
  const offersFabricChoice = sellsFabric && !fabricOnly;

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
        <div
          key={row.id}
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
            {/* The way in and out of this item's measurements on a phone.

                Below lg only. On a wide screen the panel lives in the right-hand column and is
                closed from there, and the row's own border already shows which item that column is
                showing — a chevron there would be a second control for a job already done.

                Explicit, where tapping the card was the only way before. That worked and could not
                be seen: nothing about a row said it would open, and nothing said how to shut it
                again once the fields were on screen underneath. stopPropagation so the button is
                the thing that acted, not the card it sits on — without it the card's own handler
                fires straight afterwards and toggles the panel back shut. */}
            {onItemClick && renderItemDetail && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeItemId === row.id) {
                    onItemClose?.();
                  } else {
                    onItemClick(row);
                  }
                }}
                aria-expanded={activeItemId === row.id}
                aria-label={
                  activeItemId === row.id
                    ? `Hide measurements for item ${index + 1}`
                    : `Show measurements for item ${index + 1}`
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary lg:hidden"
              >
                Measurements
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform ${activeItemId === row.id ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
              {/* Whose cloth, right in the item's header — it decides whether the row carries a
                  cloth charge at all, so it belongs above the fields it governs, not among them.
                  Absent on a fabric-only sale, where there is only one possible answer. */}
              {offersFabricChoice && (
                <div className="order-last inline-flex w-full items-center rounded-md border border-border bg-surface p-0.5 sm:order-none sm:ml-auto sm:w-auto" onClick={(e) => e.stopPropagation()}>
                  {/* Shop fabric leads, and is also what a row starts on. The pair used to run the
                      other way round, which put the default second and the exception first — the
                      eye lands on the left-hand option, so the order was quietly arguing against
                      the selection. */}
                  {(
                    [
                      { value: "internal", label: "Shop fabric" },
                      { value: "external", label: "Customer fabric" },
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
                  // it has taken over that job, so it drops back to sitting next to it. Keyed to
                  // whether the toggle is actually rendered, not to whether the shop sells cloth —
                  // on a fabric-only sale there is no toggle to defer to, and deferring anyway left
                  // Remove stranded in the middle of the header.
                  className={`ml-auto text-sm text-danger hover:text-danger-hover ${offersFabricChoice ? "sm:ml-0" : ""}`}
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
              as a pair.

              Four across from sm up, whether or not the shop sells cloth. It was five in a fabric
              shop to make room for Cloth Cost; that column is gone, and leaving the count at five
              would have stretched the remaining four across a width meant for one more.

              Absent entirely on a counter sale. Every field it holds — garment, quantity, tailoring,
              item total — belongs to a garment being made, so on a cloth sale it had nothing left in
              it and rendered as a gap between the row's heading and its cloth fields. */}
          {!fabricOnly && (
          <div className="grid max-w-2xl grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-4">
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
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-foreground/70">Quantity</label>
              {/* Chosen from a pad, over the range set in Settings › Order Entry. A count of
                  garments is whole, so allowFraction is off — there is no half a shirt, and a
                  quarter row under this pad would be four buttons that must never be pressed. */}
              <QuarterNumberInput
                ariaLabel="Quantity"
                value={row.quantity}
                onChange={(quantity) => updateRow(row.id, { quantity })}
                disabled={disabled}
                padMin={padRanges.quantity.min}
                padMax={padRanges.quantity.max}
                entryMode="pad"
                allowFraction={false}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              {/* Named for what it is. "Unit price" said nothing about which of the two amounts on
                  a fabric order it was. */}
              <label className="text-xs text-foreground/70">Tailoring Cost</label>
              {/* Read from Settings › Tailoring Cost, not typed here.

                  It was editable, and that made the shop's price list a suggestion: one order
                  stitched at a figure nobody had agreed, and no way afterwards to tell a deliberate
                  discount from a mistyped digit. The price of stitching a garment is a shop
                  decision, so it is made once on the settings screen and read here.

                  readOnly rather than disabled, so the figure stays legible and selectable instead
                  of being greyed into something that looks broken. */}
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={row.tailoringRate === "" ? "" : toNumber(row.tailoringRate).toFixed(2)}
                placeholder="Set under Settings › Tailoring Cost"
                className={readOnlyFieldClassName}
              />
            </div>
            {/* Cloth Cost used to sit here, beside Tailoring. It is gone: the same figure is
                already worked out from the cloth code, metres and rate in the fabric block below,
                so repeating it on the line above was a fourth read-only amount on a row that has
                to fit a phone — and the one people tried to type in, because it sat among the
                fields that take input. Item Total still carries it. */}
            {/* Not on a counter sale. There the row has no quantity and no stitching, so the item
                total can only ever equal the cloth amount already shown in the block below — the
                same figure twice, under two names, on a row narrow enough that both matter. What a
                cloth line comes to is the Amount beside its metres and rate. */}
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
          )}

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
                catalogue={clothCatalogue}
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
                {/* Whole metres plus a quarter, the way cloth is actually cut and measured at the
                    counter — 5 and ½ rather than a typed 5.5. The pad covers 1 to 20, which is the
                    range nearly every length falls in; anything outside it is still typed into the
                    box, so a 40 metre roll is not unreachable.

                    The same control the measurement fields use. Both were plain decimal boxes, and
                    both had the same fault: the shop reads quarters and the box asked for decimals,
                    so somebody converted in their head every time. */}
                <QuarterNumberInput
                  ariaLabel="Metres"
                  value={row.metres}
                  onChange={(metres) => updateRow(row.id, { metres })}
                  disabled={disabled || !usesShopFabric}
                  padMin={padRanges.metres.min}
                  padMax={padRanges.metres.max}
                  // Tapping the box opens the pad rather than a keyboard. A length is nearly always
                  // one of twenty numbers, and a keyboard covering half a tablet to type one digit
                  // is both the slower path and the easier one to mistype. The pad's Type button is
                  // still there for a length outside the range.
                  entryMode="pad"
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
          {/* The open item's measurements, inside the item's own card rather than in a second one
              below it.

              It used to be a sibling — its own bordered, padded box — which on a phone read as a
              separate panel that happened to be adjacent, and put two card outlines and two lots of
              padding between the garment and its figures. Here it is the last section of the row it
              belongs to, marked off by a rule the way the cloth fields above it are.

              Inside the card means clicks now bubble into the card's own handler, which is safe
              because that handler only ever opens this row and this row is already open. stopped
              anyway: relying on "the no-op is harmless" is relying on that handler never gaining a
              second responsibility. */}
          {activeItemId === row.id && renderItemDetail && (
            <div className="border-t border-border pt-3 lg:hidden" onClick={(e) => e.stopPropagation()}>
              {renderItemDetail(row)}
            </div>
          )}
        </div>
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
