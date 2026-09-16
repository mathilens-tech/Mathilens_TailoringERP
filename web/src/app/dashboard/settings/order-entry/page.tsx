"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  getOrderEntrySettings,
  saveOrderEntrySettings,
  DEFAULT_QUANTITY_RANGE,
  DEFAULT_METRES_RANGE,
  DEFAULT_MEASUREMENT_RANGE,
  MAX_DEFAULT_ITEMS,
  ORDER_KINDS_IN_ORDER,
  DEFAULT_ORDER_ENTRY_SETTINGS,
  type PadRange,
} from "@/lib/api/order-entry-settings";
import { getGarments, type Garment } from "@/lib/api/garments";
import { orderKindMeta, type OrderKind } from "@/lib/orders/order-kind";

/**
 * What the New Order screen's entry pads offer.
 *
 * <p>Quantity and metres are chosen from a pad rather than typed, because at a counter almost every
 * answer is one of a handful of numbers and a keyboard is the slower way to reach one. Which
 * handful depends entirely on the shop: one selling curtain fabric works in tens of metres, one
 * selling blouse pieces in ones, and a number chosen for either is wrong for the other.</p>
 */
export default function OrderEntrySettingsPage() {
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState<PadRange>(DEFAULT_QUANTITY_RANGE);
  const [metres, setMetres] = useState<PadRange>(DEFAULT_METRES_RANGE);
  const [measurement, setMeasurement] = useState<PadRange>(DEFAULT_MEASUREMENT_RANGE);
  const [defaultItems, setDefaultItems] = useState<Record<OrderKind, string[]>>(
    DEFAULT_ORDER_ENTRY_SETTINGS.defaultItemGarments,
  );
  // The shop's own garment list, so the pickers offer what it actually stitches.
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    // Never rejects — an unconfigured shop gets the defaults.
    const saved = await getOrderEntrySettings(getAccessToken());
    setQuantity(saved.quantity);
    setMetres(saved.metres);
    setMeasurement(saved.measurement);
    setDefaultItems(saved.defaultItemGarments);
    setGarments(await getGarments(getAccessToken()).catch(() => []));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Checked here because this is where the person who typed it is. A range the wrong way round
    // cannot lay out a pad at all, so the order screen would silently fall back to its default and
    // the setting would look saved and do nothing.
    for (const [label, range] of [["Quantity", quantity], ["Metres", metres], ["Measurements", measurement]] as const) {
      if (range.max <= range.min) {
        setError(`${label}: the highest value must be above the lowest.`);
        return;
      }
      if (range.max - range.min > 119) {
        setError(`${label}: a pad can offer at most 120 values. Narrow the range.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await saveOrderEntrySettings(
        { quantity, metres, measurement, defaultItemGarments: defaultItems },
        getAccessToken(),
      );
      showToast("Order entry settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Order Entry</h1>
        <p className="mt-1 text-sm text-foreground/70">
          The numbers offered on the New Order screen&apos;s entry pads. Anything outside a range can
          still be typed using the pad&apos;s Type button.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : (
        <>
          <RangeEditor
            label="Quantity"
            hint="How many of a garment an order usually asks for."
            range={quantity}
            onChange={setQuantity}
          />
          <RangeEditor
            label="Metres"
            hint="Lengths of cloth the shop usually sells."
            range={metres}
            onChange={setMetres}
          />
          <RangeEditor
            label="Measurements"
            hint="Used by any measurement point without a range of its own. A point measured often enough to want a tighter pad can be given one under Settings › Measurement, and that always wins over this."
            range={measurement}
            onChange={setMeasurement}
          />

          {/* What a new order opens with, per screen.

              One list answers both questions at once — how many rows, and which garment on each —
              because they are the same question asked twice: a shop that wants a third row has to
              say what the third row is for.

              Three lists, because the three screens ask for different things. A counter sale opens
              on cloth lines carrying no garment at all, while a tailoring order opens on whatever
              the shop stitches most. One shared list forced a choice that suited whichever screen
              was used most and was wrong on the other two. */}
          {ORDER_KINDS_IN_ORDER.map((kind) => (
            <DefaultItemsEditor
              key={kind}
              label={orderKindMeta(kind).label}
              hint={orderKindMeta(kind).description}
              items={defaultItems[kind]}
              garments={garments}
              onChange={(next) => setDefaultItems((current) => ({ ...current, [kind]: next }))}
            />
          ))}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/** The rows one New Order screen opens with: which garment on each, and how many there are. */
function DefaultItemsEditor({
  label,
  hint,
  items,
  garments,
  onChange,
}: {
  label: string;
  hint: string;
  items: string[];
  garments: Garment[];
  onChange: (items: string[]) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <span className="text-base font-medium">{label} — opening items</span>
      <p className="text-sm text-foreground/70">
        {hint} Remove them all to start from &ldquo;Add item&rdquo;.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-foreground/50">Opens with no items.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((garment, index) => (
            // Keyed by position, which is genuinely what identifies a row here: the list is
            // ordered, the same garment may legitimately appear twice, and rows are changed by
            // editing the picker rather than moved around.
            <li key={index} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm text-foreground/60">Item {index + 1}</span>
              <select
                aria-label={`${label}: garment for item ${index + 1}`}
                value={garment}
                onChange={(e) => onChange(items.map((name, i) => (i === index ? e.target.value : name)))}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              >
                {/* A garment chosen here and since dropped from the shop's list would otherwise
                    disappear from its own picker and be silently replaced on the next save. */}
                {garment !== "" && !garments.some((g) => g.name === garment) && (
                  <option value={garment}>{garment} (no longer offered)</option>
                )}
                {garments.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="text-sm text-danger hover:text-danger-hover"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length < MAX_DEFAULT_ITEMS && garments.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([...items, garments[0].name])}
          className="self-start text-sm font-medium text-foreground/70 hover:text-foreground"
        >
          + Add item
        </button>
      )}
    </section>
  );
}


function RangeEditor({
  label,
  hint,
  range,
  onChange,
}: {
  label: string;
  hint: string;
  range: PadRange;
  onChange: (range: PadRange) => void;
}) {
  const fieldClassName =
    "w-28 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

  return (
    <section className="flex flex-col gap-2">
      <span className="text-base font-medium">{label}</span>
      <p className="text-sm text-foreground/70">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          aria-label={`${label} lowest value`}
          value={range.min}
          onChange={(e) => onChange({ ...range, min: Number(e.target.value) })}
          className={fieldClassName}
        />
        <span className="text-sm text-foreground/60">to</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          aria-label={`${label} highest value`}
          value={range.max}
          onChange={(e) => onChange({ ...range, max: Number(e.target.value) })}
          className={fieldClassName}
        />
      </div>
    </section>
  );
}
