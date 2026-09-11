"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { type GarmentType } from "@/lib/api/measurements";
import { getGarments } from "@/lib/api/garments";
import { getAccessToken } from "@/lib/auth";
import { MeasurementValuesEditor, type ValueRowInput } from "./MeasurementValuesEditor";
import { toMeasurementValue } from "@/components/measurements/MeasurementPointInput";
import type { MeasurementValue } from "@/lib/api/measurements";

type MeasurementFormProps = {
  /** Fixed (and the select disabled) when editing — a measurement's garment type never changes after creation. */
  garmentType?: GarmentType;
  initialValues?: Record<string, MeasurementValue>;
  submitLabel: string;
  onSubmit: (garmentType: GarmentType, values: Record<string, MeasurementValue>) => Promise<void>;
  /** Closes the dialog this sits in. Omitted where the form is not dismissable. */
  onCancel?: () => void;
};

export function MeasurementForm({
  garmentType: fixedGarmentType,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: MeasurementFormProps) {
  const [garmentType, setGarmentType] = useState<GarmentType>(fixedGarmentType ?? "");
  // The shop's own garment list, so a measurement can be taken for a Chudidhar it added. Empty
  // until it arrives; the picker is only shown when this form is creating a measurement anyway.
  const [garments, setGarments] = useState<string[]>([]);
  const [rows, setRows] = useState<ValueRowInput[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Bumped by the Clear button to force MeasurementValuesEditor to remount blank — after the
  // first clear, initialValues is dropped too, so clearing again still yields blank fields
  // instead of reverting back to whatever was originally loaded.
  const [clearCount, setClearCount] = useState(0);

  useEffect(() => {
    // Skipped while editing: the garment of an existing measurement never changes, so there is no
    // picker to fill and no reason to ask.
    if (fixedGarmentType) {
      return;
    }
    let cancelled = false;
    getGarments(getAccessToken()).then((list) => {
      if (cancelled) {
        return;
      }
      setGarments(list.map((g) => g.name));
      setGarmentType((current) => current || list[0]?.name || "");
    });

    return () => {
      cancelled = true;
    };
  }, [fixedGarmentType]);

  function handleClear() {
    setFormError(null);
    setClearCount((count) => count + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const values: Record<string, MeasurementValue> = {};
    for (const row of rows) {
      // Points are individually optional — one nobody has filled in is skipped rather than
      // blocking the save. A checkbox is never skipped, because "no" is an answer.
      const value = toMeasurementValue(row.point, row.value);
      if (value === null) {
        if (row.point.type === "Number" && row.value.trim() !== "") {
          setFormError(`"${row.point.name}" needs a value greater than zero.`);
          return;
        }
        continue;
      }
      values[row.point.name] = value;
    }

    if (Object.keys(values).length === 0) {
      setFormError("Add at least one measurement point.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(garmentType, values);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!fixedGarmentType && (
        <div className="flex flex-col gap-1">
          <label htmlFor="garmentType" className="text-sm font-medium">
            Garment type
          </label>
          <select
            id="garmentType"
            value={garmentType}
            onChange={(e) => setGarmentType(e.target.value as GarmentType)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
            {garments.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      )}

      <MeasurementValuesEditor
        key={`${garmentType}-${clearCount}`}
        garmentType={garmentType}
        initialValues={clearCount === 0 ? initialValues : undefined}
        onChange={setRows}
      />

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      {/* Cancel leaves without saving; Clear empties the fields and stays. Two different things,
          so they are two different buttons rather than one that means whichever the reader guessed. */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={handleClear} disabled={isSubmitting}>
          Clear
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
