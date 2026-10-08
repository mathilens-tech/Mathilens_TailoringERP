"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { downloadMeasurementBackup } from "@/lib/api/reports";

/**
 * A printable backup of every customer's measurements.
 *
 * <p>No table on screen — the whole point is the document: a colour PDF with a cover, an index of
 * every customer against the page their measurements land on, and a compact section each. So the
 * screen is a single download, built entirely on the server (see MeasurementBackupPdf).</p>
 */
export default function MeasurementBackupReportPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setIsDownloading(true);
    setError(null);
    try {
      await downloadMeasurementBackup(getAccessToken());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate the backup. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Measurements</h1>
        <p className="mt-1 text-sm text-foreground/70">
          A printable backup of every customer and the measurements on file for them.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Measurement backup (PDF)</h2>
          <p className="text-sm text-foreground/70">
            The document opens with the shop wordmark and an index listing every customer, their
            mobile number and the page their measurements are on — so a measurement can be found by
            turning to the page. Garments are laid out compactly, two columns of figures each.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div>
          <Button type="button" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Generating…" : "Download PDF"}
          </Button>
        </div>

        <p className="text-xs text-foreground/50">
          Large books take a few seconds — the whole customer list is gathered and drawn into one
          file.
        </p>
      </div>
    </div>
  );
}
