"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { downloadBackup, BACKUP_FORMATS, type BackupFormat } from "@/lib/api/backup";

/**
 * Downloads everything the shop holds, as one file.
 *
 * <p>Called a download rather than a backup in the wording on screen, and the difference is not
 * pedantry: nothing in this product reads any of these files back. A button labelled "Backup" on a
 * product with no restore is a promise the shop will only discover is empty on the day it matters,
 * so the page says what it does and what it does not.</p>
 */
export default function BackupSettingsPage() {
  const { showToast } = useToast();
  const [format, setFormat] = useState<BackupFormat>("Json");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setIsDownloading(true);
    try {
      const { isTruncated } = await downloadBackup(format, getAccessToken());
      if (isTruncated) {
        // Not a toast that fades: a short backup is the one thing about this screen somebody has
        // to act on, and it must still be on screen when they come back to look.
        setError(
          "This download hit the row limit, so it does not contain everything. Some tables were cut at 50,000 rows.",
        );
      } else {
        showToast("Backup downloaded.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to download the backup.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Backup</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Downloads everything the shop holds — customers, employees, orders, invoices, measurements,
          fabric details, inventory receipts, WhatsApp messages and settings — as a single file.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Format</legend>
        {BACKUP_FORMATS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              format === option.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <input
              type="radio"
              name="backupFormat"
              value={option.value}
              checked={format === option.value}
              onChange={() => setFormat(option.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {option.label}
                <span className="ml-2 font-mono text-xs font-normal text-foreground/60">{option.extension}</span>
              </span>
              <span className="mt-0.5 block text-sm text-foreground/70">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? "Preparing…" : "Download backup"}
        </Button>
      </div>

      {/* Both of these are things a shop would otherwise find out at the worst moment. */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-hover/40 p-4 text-sm text-foreground/70">
        <p>
          <span className="font-medium text-foreground">This is a download, not a restore point.</span>{" "}
          Nothing in this product reads these files back in. Keep the JSON if the backup may ever need
          to be loaded into something else — it is the only format that keeps the data&apos;s structure.
        </p>
        <p>
          <span className="font-medium text-foreground">It contains personal data.</span> Every
          customer&apos;s name, phone number, address and dates are in this file. Store it somewhere you
          would be willing to store the customer book itself.
        </p>
      </div>
    </div>
  );
}
