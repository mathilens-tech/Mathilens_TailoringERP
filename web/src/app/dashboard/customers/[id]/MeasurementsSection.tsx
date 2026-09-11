"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MeasurementForm } from "@/components/measurements/MeasurementForm";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { listMeasurementsForCustomer, createMeasurement, updateMeasurementValues, type Measurement, type GarmentType } from "@/lib/api/measurements";
import { formatMeasurementValue, type MeasurementValue } from "@/lib/api/measurements";

type FormState = { mode: "create" } | { mode: "edit"; measurement: Measurement } | null;

/** Embedded in the customer detail page — measurements are always accessed through their owning customer, never as a standalone top-level list. */
export function MeasurementsSection({ customerId }: { customerId: string }) {
  const { showToast } = useToast();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listMeasurementsForCustomer(customerId, getAccessToken());
      setMeasurements(data);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load measurements.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-mount pattern is intentionally not restructured
    // around the set-state-in-effect lint rule — the same reasoning applies here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(garmentType: GarmentType, values: Record<string, MeasurementValue>) {
    await createMeasurement(customerId, garmentType, values, getAccessToken());
    showToast("Measurement added.");
    setFormState(null);
    await load();
  }

  async function handleUpdate(measurementId: string, values: Record<string, MeasurementValue>) {
    await updateMeasurementValues(measurementId, values, getAccessToken());
    showToast("Measurement updated.");
    setFormState(null);
    await load();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Measurements</h2>
        {/* Always shown now: the form opens over the page rather than in place of this button. */}
        <Button type="button" variant="secondary" onClick={() => setFormState({ mode: "create" })}>
          Add Measurement
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : measurements.length === 0 ? (
        <p className="text-sm text-foreground/70">No measurements recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {measurements.map((measurement) => (
            <li key={measurement.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{measurement.garmentType}</span>
                <span className="ml-2 text-foreground/70">
                  {Object.entries(measurement.values)
                    .map(([name, value]) => `${name}: ${formatMeasurementValue(value)}`)
                    .join(", ")}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormState({ mode: "edit", measurement })}
                  className="text-foreground/70 hover:text-foreground"
                >
                  Edit
                </button>
                <Link href={`/dashboard/measurements/${measurement.id}/history`} className="text-foreground/70 hover:text-foreground">
                  History
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* A dialog rather than a panel below the list: taking a measurement is a form of its own, and
          inline it pushed the customer's orders and details down the page every time it opened. The
          garment named in the header is what says which record is being changed. */}
      <Modal
        open={formState !== null}
        title={formState?.mode === "edit" ? "Edit Measurement" : "Add Measurement"}
        description={formState?.mode === "edit" ? formState.measurement.garmentType : undefined}
        onClose={() => setFormState(null)}
      >
        {/* Guarded because JSX children are built before Modal decides whether to render them. */}
        {formState && (
          <MeasurementForm
            key={formState.mode === "edit" ? formState.measurement.id : "create"}
            garmentType={formState.mode === "edit" ? formState.measurement.garmentType : undefined}
            initialValues={formState.mode === "edit" ? formState.measurement.values : undefined}
            submitLabel={formState.mode === "create" ? "Add measurement" : "Save changes"}
            onCancel={() => setFormState(null)}
            onSubmit={(garmentType, values) =>
              formState.mode === "create" ? handleCreate(garmentType, values) : handleUpdate(formState.measurement.id, values)
            }
          />
        )}
      </Modal>
    </div>
  );
}
