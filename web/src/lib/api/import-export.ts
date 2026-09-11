import { apiGetFile, apiPostFile } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";

/** What an import did, per 00_MASTER_SPEC.md § 8.6 — rows that failed are addressed by their spreadsheet row number. */
export type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: { rowNumber: number; message: string }[];
};

/** Which file the Export button should produce. */
export type ExportFormat = "xlsx" | "pdf";

/**
 * Downloads a module's export in the chosen format, under the server's filename.
 *
 * The filename carries the date, so a folder of exports taken over a month sorts sensibly instead
 * of becoming a pile of same-named files with browser-appended numbers.
 */
export async function downloadExport(
  resource: string,
  format: ExportFormat,
  token: string | null,
  query?: Record<string, string>,
): Promise<void> {
  const params = new URLSearchParams({ format, ...query });
  // The fallback names the format actually asked for, so a file can never arrive under the wrong
  // extension even if the server's own filename goes missing again. It loses only the date.
  const { blob, filename } = await apiGetFile(
    `/api/v1/${resource}/export?${params}`,
    token,
    `${resource}.${format}`,
  );
  saveBlob(blob, filename);
}

export function uploadImport(resource: string, file: File, token: string | null): Promise<ImportResult> {
  return apiPostFile<ImportResult>(`/api/v1/${resource}/import`, file, token);
}

/** A row in the upload that collides with an existing customer, or with another row of the file. */
export type ImportDuplicate = {
  rowNumber: number;
  name: string;
  phoneNumber: string;
  /** One sentence naming who it collides with and what will happen to it. */
  reason: string;
};

/** What an upload would do, worked out without doing it. */
export type ImportPreview = {
  totalRows: number;
  willCreate: number;
  willUpdate: number;
  willFail: number;
  errors: { rowNumber: number; message: string }[];
  duplicates: ImportDuplicate[];
};

/**
 * Dry-runs an upload so the operator sees what it will do before committing (FR-04).
 *
 * <p>Writes nothing. The server plans the rows with the same code the real import executes, so
 * the counts shown here are what the import produces, not an estimate of them.</p>
 */
export function previewImport(resource: string, file: File, token: string | null): Promise<ImportPreview> {
  return apiPostFile<ImportPreview>(`/api/v1/${resource}/import/preview`, file, token);
}

/** Turns an import result into the one-line summary the list pages toast. */
export function summarizeImport(result: ImportResult): string {
  const parts = [`${result.created} added`, `${result.updated} updated`];
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  return parts.join(", ") + ".";
}
