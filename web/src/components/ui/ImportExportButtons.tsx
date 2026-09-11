"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { previewImport, summarizeImport, uploadImport, type ImportPreview, type ImportResult } from "@/lib/api/import-export";
import { ExportButton } from "./ExportButton";
import { toDisplayPhoneNumber } from "@/lib/contact";

type ImportExportButtonsProps = {
  /** The API resource segment, e.g. "customers" — both endpoints hang off it. */
  resource: string;
  /** What to call the records in messages, e.g. "customers". */
  label: string;
  /** Called after a successful import so the list can reload. */
  onImported: () => void | Promise<void>;
  /**
   * Dry-run the file and show what it would do before writing anything (FR-04).
   *
   * <p>Opt-in, because it needs an <c>import/preview</c> endpoint on the resource — only
   * customers has one. Without it the upload behaves as it always did.</p>
   */
  previewBeforeImport?: boolean;
};

/**
 * Export/Import pair for a master-data list page. Imports are partial-success, so a run that
 * reports failures shows them inline (addressed by spreadsheet row) rather than only toasting —
 * the operator needs to know which rows to fix before re-uploading.
 */
export function ImportExportButtons({ resource, label, onImported, previewBeforeImport = false }: ImportExportButtonsProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  // The chosen file is held across the confirmation step — the same one is uploaded, so what was
  // approved is what runs.
  const [pending, setPending] = useState<{ file: File; preview: ImportPreview } | null>(null);

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file twice in a row still fires a change event.
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!previewBeforeImport) {
      await runImport(file);
      return;
    }

    setIsImporting(true);
    setLastResult(null);
    try {
      setPending({ file, preview: await previewImport(resource, file, getAccessToken()) });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : `Unable to read this ${label} file.`, "error");
    } finally {
      setIsImporting(false);
    }
  }

  async function runImport(file: File) {
    setIsImporting(true);
    setLastResult(null);
    try {
      const result = await uploadImport(resource, file, getAccessToken());
      setLastResult(result);
      showToast(summarizeImport(result), result.failed > 0 ? "error" : "success");
      await onImported();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : `Unable to import ${label}.`, "error");
    } finally {
      setIsImporting(false);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {/* Export is its own component now: it asks for a format, and the same chooser is reused by
            screens that have no import at all. */}
        <ExportButton resource={resource} label={label} />
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          {isImporting ? "Importing…" : "Import"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileChosen}
          className="hidden"
        />
      </div>

      {/* Shown before anything is written. An import that silently merges two people because a
          sheet reused a phone number is only discoverable once the two records are already one. */}
      {pending && (
        <Modal
          open
          title="Review this import"
          description={`${pending.preview.totalRows} row${pending.preview.totalRows === 1 ? "" : "s"} in the file. Nothing has been saved yet.`}
          onClose={() => setPending(null)}
        >
          <div className="flex flex-col gap-4 text-left">
            <dl className="grid grid-cols-3 gap-3">
              <Tally label="Will be added" value={pending.preview.willCreate} />
              <Tally label="Will be updated" value={pending.preview.willUpdate} />
              <Tally label="Will be skipped" value={pending.preview.willFail} tone={pending.preview.willFail > 0 ? "danger" : undefined} />
            </dl>

            {pending.preview.duplicates.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                <p className="font-medium text-foreground">
                  {pending.preview.duplicates.length} row
                  {pending.preview.duplicates.length === 1 ? "" : "s"} match a customer already on file:
                </p>
                <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-foreground/80">
                  {pending.preview.duplicates.map((duplicate) => (
                    <li key={duplicate.rowNumber}>
                      Row {duplicate.rowNumber} ({duplicate.name} — {toDisplayPhoneNumber(duplicate.phoneNumber)}): {duplicate.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pending.preview.errors.length > 0 && (
              <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-xs">
                <p className="font-medium text-danger">
                  {pending.preview.errors.length} row{pending.preview.errors.length === 1 ? "" : "s"} will be skipped:
                </p>
                <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-foreground/80">
                  {pending.preview.errors.map((rowError) => (
                    <li key={rowError.rowNumber}>
                      Row {rowError.rowNumber}: {rowError.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPending(null)} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => runImport(pending.file)}
                // Nothing to apply is not an import — the file is all errors, and the list above
                // is the useful outcome.
                disabled={isImporting || pending.preview.willCreate + pending.preview.willUpdate === 0}
              >
                {isImporting ? "Importing…" : `Import ${pending.preview.willCreate + pending.preview.willUpdate} row${pending.preview.willCreate + pending.preview.willUpdate === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {lastResult && lastResult.errors.length > 0 && (
        <div role="alert" className="max-w-md rounded-md border border-danger/40 bg-danger/5 p-3 text-left text-xs">
          <p className="font-medium text-danger">
            {lastResult.failed} row{lastResult.failed === 1 ? "" : "s"} could not be imported:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-foreground/80">
            {lastResult.errors.slice(0, 10).map((rowError) => (
              <li key={rowError.rowNumber}>
                Row {rowError.rowNumber}: {rowError.message}
              </li>
            ))}
          </ul>
          {lastResult.errors.length > 10 && (
            <p className="mt-1 text-foreground/60">…and {lastResult.errors.length - 10} more.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** One of the three counts in the import preview. */
function Tally({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <dt className="text-xs text-foreground/70">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${tone === "danger" ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}
