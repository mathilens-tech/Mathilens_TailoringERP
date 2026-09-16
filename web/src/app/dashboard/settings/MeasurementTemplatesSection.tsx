"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { invalidateMeasurementTemplates } from "@/lib/use-measurement-templates";
import {
  listMeasurementTemplates,
  setMeasurementTemplate,
  resetMeasurementTemplate,
  MEASUREMENT_POINT_TYPES,
  hasRange,
  hasSecondValue,
  type MeasurementPoint,
  type MeasurementPointType,
  type GarmentType,
  type MeasurementTemplate,
} from "@/lib/api/measurements";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** Which point the name dialog is for: an index to rename, or null to add a new one. */
/** A point being added or edited: its name, and the kind of answer it takes. */
/**
 * A point being added or edited.
 *
 * `min` and `max` are held as the text the fields contain rather than as numbers, so a half-typed
 * "3" on the way to "36" is a state this can be in. They become numbers, or null, only on save.
 */
type PointDraft = {
  index: number | null;
  name: string;
  type: MeasurementPointType;
  min: string;
  max: string;
  /** The second box's label. Empty means one box, which is what every point had before. */
  secondName: string;
  /** False restricts the point to whole numbers. True is the default and what older points do. */
  decimals: boolean;
};

/**
 * Which measurement points a garment type asks for, and in what order — "Pant: 1. length,
 * 2. waist" is a shop preference, not a fact about tailoring, so it is configured rather than
 * hardcoded. The order set here is the order the points appear in on the New Order screen and on
 * the customer measurement form.
 */
export function MeasurementTemplatesSection() {
  const { showToast } = useToast();
  const [garmentType, setGarmentType] = useState<GarmentType>("");
  const [templates, setTemplates] = useState<Record<string, MeasurementTemplate>>({});
  // The garments this shop stitches, in the order the API returned them. It answers with one
  // template per garment on the shop's own list (Settings › Garments), so this picker follows that
  // list rather than a fixed set — a shop that added Chudidhar needs points for it.
  const [garmentTypes, setGarmentTypes] = useState<string[]>([]);
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<PointDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [showRestore, setShowRestore] = useState(false);

  // The row picked up, and the row the pointer is currently over. Both are indices into `points`.
  //
  // The picked-up row is held in a ref as well as in state: the drop handler needs it as it runs,
  // and state set during dragstart is only visible to a handler from a later render. A drag with a
  // pointer takes long enough that a render always lands in between, but that is a timing accident
  // to depend on rather than a guarantee.
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await listMeasurementTemplates(getAccessToken());
      setTemplates(Object.fromEntries(loaded.map((t) => [t.garmentType, t])));
      setGarmentTypes(loaded.map((t) => t.garmentType));
      // Holds the current pick across a reload, and lands on the first garment on the first load.
      setGarmentType((current) => (loaded.some((t) => t.garmentType === current) ? current : loaded[0]?.garmentType ?? ""));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load measurement templates.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // Switching garment type discards any unsaved edits to the previous one — the alternative is
    // silently carrying half-finished lists between garments, which is worse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPoints(templates[garmentType]?.points ?? []);
  }, [garmentType, templates]);

  const current = templates[garmentType];
  const isDirty = current !== undefined && JSON.stringify(points) !== JSON.stringify(current.points);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= points.length) {
      return;
    }
    const next = [...points];
    [next[index], next[target]] = [next[target], next[index]];
    setPoints(next);
  }

  /** Lifts one point out and puts it back at another position, closing the gap behind it. */
  function reorder(from: number, to: number) {
    if (from === to) {
      return;
    }
    const next = [...points];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPoints(next);
  }

  function remove(index: number) {
    setPoints(points.filter((_, i) => i !== index));
  }

  function startDrag(index: number) {
    dragIndexRef.current = index;
    setDragIndex(index);
  }

  function endDrag() {
    dragIndexRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, to: number) {
    event.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null) {
      reorder(from, to);
    }
    endDrag();
  }

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftError(null);

    if (!draft) {
      return;
    }

    const name = draft.name.trim();
    if (!name) {
      setDraftError("Enter a name for this point.");
      return;
    }

    // Two points under the same name would be two boxes asking the same question on the
    // measurement form, with no way to tell which answer went where.
    const clash = points.some((p, i) => i !== draft.index && p.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      setDraftError(`"${name}" is already in this template.`);
      return;
    }

    // A range is a figure's business. Switching a point to Tick or Text with bounds still in the
    // boxes drops them rather than storing configuration the entry screen will never read.
    const wantsRange = draft.type === "Number" && (draft.min.trim() !== "" || draft.max.trim() !== "");
    let min: number | null = null;
    let max: number | null = null;

    if (wantsRange) {
      min = Number(draft.min);
      max = Number(draft.max);

      // Checked here as well as on the server, because this is where the person who typed it is.
      // The same three rules, in the same order, so a message never differs between the two.
      if (draft.min.trim() === "" || draft.max.trim() === "") {
        setDraftError("A range needs both a lowest and a highest value, or neither.");
        return;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        setDraftError("A range's values must be numbers.");
        return;
      }
      if (max <= min) {
        setDraftError("The highest value must be above the lowest.");
        return;
      }
    }

    // A second box, and the whole/decimal choice, are a figure's business too — switching the point
    // to Tick or Text drops both rather than storing settings the entry screen will never read.
    const secondName = draft.type === "Number" ? draft.secondName.trim() : "";
    if (secondName !== "" && secondName.toLowerCase() === name.toLowerCase()) {
      setDraftError("The two boxes need different labels.");
      return;
    }
    // Two boxes are two entries in the values map, so the second label collides with other points
    // exactly as a point name would.
    const secondClash = secondName !== "" && points.some(
      (p, i) => i !== draft.index && (p.name.toLowerCase() === secondName.toLowerCase()
        || (p.secondName ?? "").toLowerCase() === secondName.toLowerCase()),
    );
    if (secondClash) {
      setDraftError(`"${secondName}" is already used by another point in this template.`);
      return;
    }

    const point: MeasurementPoint = {
      name,
      type: draft.type,
      min,
      max,
      secondName: secondName === "" ? null : secondName,
      decimals: draft.type === "Number" ? draft.decimals : null,
    };
    setPoints(draft.index === null ? [...points, point] : points.map((p, i) => (i === draft.index ? point : p)));
    setDraft(null);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const saved = await setMeasurementTemplate(garmentType, points, getAccessToken());
      setTemplates((prev) => ({ ...prev, [garmentType]: saved }));
      // Screens already open (New Order, customer measurements) pick the new order up without a reload.
      invalidateMeasurementTemplates();
      showToast(`${garmentType} measurement points saved.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this template.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setError(null);
    setIsSaving(true);
    try {
      await resetMeasurementTemplate(garmentType, getAccessToken());
      await load();
      invalidateMeasurementTemplates();
      setShowRestore(false);
      showToast(`${garmentType} restored to the standard points.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset this template.");
      setShowRestore(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateGarmentType" className="text-sm font-medium">
            Garment type
          </label>
          <select
            id="templateGarmentType"
            value={garmentType}
            onChange={(e) => setGarmentType(e.target.value as GarmentType)}
            className={fieldClassName}
            disabled={isLoading}
          >
            {garmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
                {templates[type]?.isCustomised ? " (customised)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={() => {
            setDraft({ index: null, name: "", type: "Number", min: "", max: "", secondName: "", decimals: true });
            setDraftError(null);
          }}
          disabled={isLoading}
        >
          Add Point
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : (
        <>
          {/*
            Rows are dragged to reorder, and the arrows do the same thing from a keyboard — drag is
            a pointer gesture with no keyboard equivalent, so removing them would lock reordering
            away from anyone not using a mouse.
          */}
          <ol className="flex flex-col gap-2">
            {points.map((point, index) => (
              <li
                key={`${point.name}-${index}`}
                draggable
                onDragStart={() => startDrag(index)}
                onDragEnter={() => setDropIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={endDrag}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-1.5 transition-colors sm:gap-2 sm:px-2 ${
                  dragIndex === index
                    ? "border-primary bg-primary/5 opacity-60"
                    : dropIndex === index && dragIndex !== null
                      ? "border-primary bg-primary/5"
                      : "border-border"
                }`}
              >
                {/* The grip is the affordance; the whole row is the drag target, so a shaky grab
                    still picks the row up. Hidden on a phone, where HTML5 drag does not respond to
                    touch at all and the arrows are the way a row moves. */}
                <span aria-hidden="true" className="hidden cursor-grab select-none px-1 text-foreground/40 sm:inline">
                  ⠿
                </span>
                <span className="w-5 shrink-0 text-sm tabular-nums text-foreground/60 sm:w-6">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {point.name}
                  {/* The pair on one line, so a two-box point is recognisable without opening it.
                      The separator is what says they belong together. */}
                  {hasSecondValue(point) && (
                    <span className="text-foreground/50"> + {point.secondName}</span>
                  )}
                </span>
                {/* Only the restriction is worth a badge. Almost every figure allows decimals, so
                    marking those would label nearly every row with the default. */}
                {point.type === "Number" && point.decimals === false && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground/60">
                    Whole
                  </span>
                )}
                {/* The range on the row, so a template can be read without opening every point to
                    find which ones have one. Only when it is complete and usable — hasRange is the
                    same test the order screen applies before offering a pad, so what is shown here
                    and what happens there cannot disagree. */}
                {hasRange(point) && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/50">
                    {point.min}–{point.max}
                  </span>
                )}
                {/* Only the two new kinds are labelled. Marking every figure "Number" would be a
                    badge on almost every row, saying what the field it opens already shows. */}
                {point.type !== "Number" && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground/60">
                    {point.type === "Checkbox" ? "Tick" : "Text"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${point.name} up`}
                  className="rounded-md border border-border px-1.5 py-1 text-sm text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:px-2"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === points.length - 1}
                  aria-label={`Move ${point.name} down`}
                  className="rounded-md border border-border px-1.5 py-1 text-sm text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:px-2"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({
                      index,
                      name: point.name,
                      type: point.type,
                      // Back to text for editing. Null and undefined both become an empty box,
                      // which is what "no range" looks like to the person opening this.
                      min: point.min === null || point.min === undefined ? "" : String(point.min),
                      max: point.max === null || point.max === undefined ? "" : String(point.max),
                      secondName: point.secondName ?? "",
                      // Absent means allowed — the same reading the server and the field use, so a
                      // point that has never been asked opens with the box ticked.
                      decimals: point.decimals !== false,
                    });
                    setDraftError(null);
                  }}
                  className="whitespace-nowrap px-1 text-sm text-foreground/70 transition-colors hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${point.name}`}
                  className="rounded-md border border-border px-1.5 py-1 text-sm text-danger transition-colors hover:text-danger-hover sm:px-2"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>

          {points.length === 0 && (
            <p className="text-sm text-foreground/70">No points yet — use Add Point to make the first one.</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowRestore(true)}
              disabled={isSaving || !current?.isCustomised}
              className="text-sm text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Restore standard points
            </button>
            <Button type="button" onClick={handleSave} disabled={isSaving || points.length === 0 || !isDirty}>
              {isSaving ? "Saving…" : "Save template"}
            </Button>
          </div>
        </>
      )}

      <Modal
        open={draft !== null}
        title={draft?.index === null ? "Add Point" : "Edit Point"}
        onClose={() => setDraft(null)}
      >
        <form onSubmit={handleNameSubmit} className="flex flex-col">
          <Input
            id="pointName"
            label="Measurement point"
            placeholder="e.g. Bottom opening"
            value={draft?.name ?? ""}
            onChange={(e) => setDraft((c) => (c ? { ...c, name: e.target.value } : c))}
            ref={nameRef}
            autoFocus
          />
          {/* What the point asks for. A chest is a figure; a side pocket is a tick; a collar style
              is a word. The New Order screen renders whichever is chosen here. */}
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-sm font-medium">Answer type</span>
            <div className="grid grid-cols-3 gap-2">
              {MEASUREMENT_POINT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={draft?.type === type}
                  onClick={() => setDraft((c) => (c ? { ...c, type } : c))}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    draft?.type === type
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-border text-foreground/70 hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {type === "Number" ? "Number" : type === "Checkbox" ? "Tick" : "Text"}
                </button>
              ))}
            </div>
          </div>

          {/* Whole numbers or fractions, and a second box — both only on a figure, for the same
              reason the range is: a tick and a word have neither a precision nor a pair. */}
          {draft?.type === "Number" && (
            <>
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-sm font-medium">Values</span>
                <label className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={draft.decimals}
                    onChange={(e) => setDraft((c) => (c ? { ...c, decimals: e.target.checked } : c))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    Allow decimals
                    <span className="ml-1 text-foreground/60">(e.g. 35.34)</span>
                  </span>
                </label>
                <p className="text-xs text-foreground/60">
                  Unticked, this point takes whole numbers only and the phone keypad drops its
                  decimal point.
                </p>
              </div>

              {/* One figure or two. Stated as a choice rather than left to be inferred from whether
                  a second label happens to be filled in — "does this point take one measurement or
                  two" is the question being answered, and naming the box is a consequence of the
                  answer rather than the answer itself. */}
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-sm font-medium">Values</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { multi: false, label: "Single value", hint: "One figure — e.g. 40½" },
                      { multi: true, label: "Multi value", hint: "Two figures — e.g. 50¼ and 3½" },
                    ] as const
                  ).map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      aria-pressed={(draft.secondName.trim() !== "") === choice.multi}
                      onClick={() =>
                        setDraft((c) =>
                          c
                            ? {
                                ...c,
                                // Choosing Multi seeds a label so the box is usable immediately;
                                // choosing Single clears it, which is what makes the point single.
                                secondName: choice.multi ? c.secondName.trim() || `${c.name.trim() || "Value"} 2` : "",
                              }
                            : c,
                        )
                      }
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        (draft.secondName.trim() !== "") === choice.multi
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-border text-foreground/70 hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-medium">{choice.label}</span>
                      <span className="block text-xs text-foreground/60">{choice.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {draft.secondName.trim() !== "" && (
                <div className="mt-3 flex flex-col gap-1">
                  <span className="text-sm font-medium">Second value&apos;s label</span>
                  <p className="mb-1 text-xs text-foreground/60">
                    What the second figure is called — it is saved and shown under this name.
                  </p>
                  <input
                    type="text"
                    aria-label="Second value label"
                    placeholder={draft.name ? `e.g. ${draft.name} (tight)` : "e.g. Chest (tight)"}
                    value={draft.secondName}
                    onChange={(e) => setDraft((c) => (c ? { ...c, secondName: e.target.value } : c))}
                    className={fieldClassName}
                  />
                </div>
              )}
            </>
          )}

          {draft?.type === "Number" && (
            <div className="mt-3 flex flex-col gap-1">
              <span className="text-sm font-medium">
                Range <span className="font-normal text-foreground/60">(optional)</span>
              </span>
              <p className="mb-1 text-xs text-foreground/60">
                Set both to give this point a number pad on the order screen, instead of a typed box.
                Leave them empty to keep it typed.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-label="Lowest value"
                  placeholder="Lowest"
                  value={draft.min}
                  onChange={(e) => setDraft((c) => (c ? { ...c, min: e.target.value } : c))}
                  className={`${fieldClassName} w-28`}
                />
                <span className="text-sm text-foreground/60">to</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-label="Highest value"
                  placeholder="Highest"
                  value={draft.max}
                  onChange={(e) => setDraft((c) => (c ? { ...c, max: e.target.value } : c))}
                  className={`${fieldClassName} w-28`}
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-foreground/60">
            Added to the end of the list. Drag it into place, then Save template.
          </p>

          {draftError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {draftError}
            </p>
          )}

          <ModalActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft((c) => (c ? { ...c, name: "" } : c));
                setDraftError(null);
                nameRef.current?.focus();
              }}
            >
              CLEAR
            </Button>
            <Button type="submit">SUBMIT</Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Not phrased as a delete — nothing is destroyed, the list goes back to what it shipped as.
          The shop's own version of it is what is lost, which is what the description says. */}
      <ConfirmDialog
        open={showRestore}
        title="Restore standard points"
        description={`Put ${garmentType} back to the points it shipped with? The changes this shop has made to the list are discarded.`}
        confirmLabel="Restore"
        confirmingLabel="Restoring…"
        confirmVariant="primary"
        isConfirming={isSaving}
        onConfirm={handleReset}
        onCancel={() => setShowRestore(false)}
      />
    </div>
  );
}
