"use client";

import { useEffect, useState } from "react";
import type { GarmentType, MeasurementPoint, MeasurementValue } from "@/lib/api/measurements";
import { useMeasurementFields } from "@/lib/use-measurement-templates";
import { MeasurementPointInput, toFieldText } from "@/components/measurements/MeasurementPointInput";

/** The point and what has been typed into it. Carries the point itself, not just its name, because
 *  the caller has to know whether "true" is a tick or the word "true" when it converts. */
export type ValueRowInput = { point: MeasurementPoint; value: string };

type Row = ValueRowInput & { id: number };

function toRows(fields: readonly MeasurementPoint[], values: Record<string, MeasurementValue>): Row[] {
  return fields.map((point, id) => ({ id, point, value: toFieldText(values[point.name]) }));
}

type MeasurementValuesEditorProps = {
  garmentType: GarmentType;
  initialValues?: Record<string, MeasurementValue>;
  onChange: (rows: ValueRowInput[]) => void;
};

/** Renders the shop's configured measurement points for a garment type (Settings › Measurement
 * Templates), in the configured order. Callers should remount this (e.g. a `key` on the parent
 * form keyed to whatever's being edited) when switching targets — entered values are not kept in
 * sync with later prop changes. */
export function MeasurementValuesEditor({ garmentType, initialValues = {}, onChange }: MeasurementValuesEditorProps) {
  const { fields, isLoading } = useMeasurementFields(garmentType);
  const [rows, setRows] = useState<Row[]>(() => toRows(fields, initialValues));

  useEffect(() => {
    // The template arrives from the API, so the rows are rebuilt when it lands rather than only
    // at mount. Reporting them to the parent immediately also matters for the pre-filled case:
    // reviewing existing values and saving without touching a field must not look like nothing
    // was entered.
    const next = toRows(fields, initialValues);
    // Genuinely synchronizing with an external system: the template is fetched, so the rows it
    // defines cannot be known during the first render and there is nothing to derive them from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(next);
    onChange(next.map(({ point, value }) => ({ point, value })));
    // initialValues/onChange are caller-recreated each render; `fields` is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function updateValue(id: number, value: string) {
    const next = rows.map((row) => (row.id === id ? { ...row, value } : row));
    setRows(next);
    onChange(next.map(({ point, value }) => ({ point, value })));
  }


  if (isLoading) {
    return <p className="text-sm text-foreground/70">Loading measurement points…</p>;
  }

  if (fields.length === 0) {
    return <p className="text-sm text-foreground/70">No measurement points configured for {garmentType} yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <MeasurementPointInput
          key={row.id}
          point={row.point}
          value={row.value}
          onChange={(next) => updateValue(row.id, next)}
        />
      ))}
    </div>
  );
}
