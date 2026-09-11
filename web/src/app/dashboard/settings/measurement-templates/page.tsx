"use client";

import { MeasurementTemplatesSection } from "../MeasurementTemplatesSection";

/**
 * Which measurement points each garment type asks for, and in what order.
 *
 * Editing is Settings-gated, but the templates themselves are read by Front Desk and Tailor on the
 * measurement screens — which is why the API serves them from the Measurements endpoints rather
 * than the Settings ones. Splitting this page off changes who can edit them not at all.
 */
export default function MeasurementTemplatesSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Measurement</h1>
      <MeasurementTemplatesSection />
    </div>
  );
}
