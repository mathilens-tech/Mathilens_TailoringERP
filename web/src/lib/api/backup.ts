import { apiGetFile } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";

/**
 * Which file the whole-shop backup comes down as.
 *
 * Separate from the per-screen `ExportFormat` in `@/lib/api/import-export`, and mirrors
 * `BackupFormat` on the server: those exports carry one table and offer two formats, this carries
 * every table and offers four. The strings are the enum member names, which is what the API binds.
 */
export type BackupFormat = "Json" | "Xlsx" | "Csv" | "Pdf";

export type BackupFormatOption = {
  value: BackupFormat;
  label: string;
  /** What the shop actually receives — the extension is the part people ask about. */
  extension: string;
  description: string;
};

export const BACKUP_FORMATS: readonly BackupFormatOption[] = [
  {
    value: "Json",
    label: "JSON",
    extension: ".json",
    description:
      "One structured file with every table. The only format that keeps the data's shape, so it is the one to keep if the backup is ever to be read by anything other than a person.",
  },
  {
    value: "Xlsx",
    label: "Excel",
    extension: ".xlsx",
    description: "One workbook, a sheet per table. For reading, sorting and totalling.",
  },
  {
    value: "Csv",
    label: "CSV",
    extension: ".zip",
    description:
      "A zip holding one CSV per table — a CSV file holds a single table, and a backup is several.",
  },
  {
    value: "Pdf",
    label: "PDF",
    extension: ".pdf",
    description: "A printable document, a section per table. For filing or handing over.",
  },
];

/** True when the server had to cap a table, so the file does not hold everything. */
export type BackupResult = {
  isTruncated: boolean;
};

/**
 * Downloads the backup and saves it under the server's filename.
 *
 * <p>The truncation flag rides on a header rather than in the body, because three of the four
 * formats are binary and have nowhere a reader would notice a warning. It is reported back so the
 * screen can say the file is short — a truncated backup that looks complete is the failure this
 * guards against.</p>
 */
export async function downloadBackup(format: BackupFormat, token: string | null): Promise<BackupResult> {
  const option = BACKUP_FORMATS.find((entry) => entry.value === format);
  const { blob, filename, headers } = await apiGetFile(
    `/api/v1/backup/export?format=${format}`,
    token,
    `mathilens-backup${option?.extension ?? ""}`,
  );
  saveBlob(blob, filename);

  return { isTruncated: headers.get("X-Backup-Truncated") === "true" };
}
