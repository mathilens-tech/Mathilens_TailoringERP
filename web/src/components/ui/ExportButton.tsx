"use client";

import { useState } from "react";
import { Button } from "./Button";
import { useToast } from "./ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { downloadExport, type ExportFormat } from "@/lib/api/import-export";

/**
 * Export, with the format asked for rather than assumed.
 *
 * One button that opens a two-way choice, not two buttons: the screens this sits on already carry
 * a New button, filters and often an Import, and a second permanent button for a rarely-used
 * format earns less than it costs in clutter.
 *
 * <p>`query` carries whatever the screen is currently filtered by, so an export matches what is on
 * screen. Exporting the unfiltered set from a filtered view is a quiet way to hand somebody the
 * wrong numbers.</p>
 */
export function ExportButton({
  resource,
  label,
  query,
}: {
  /** API segment, e.g. "customers" — the endpoint is /api/v1/{resource}/export. */
  resource: string;
  /** What is being exported, for the error message: "Unable to export customers." */
  label: string;
  query?: Record<string, string>;
}) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [busyWith, setBusyWith] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    setBusyWith(format);
    try {
      await downloadExport(resource, format, getAccessToken(), query);
      setIsOpen(false);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : `Unable to export ${label}.`, "error");
    } finally {
      setBusyWith(null);
    }
  }

  return (
    <div className="relative">
      <Button type="button" variant="secondary" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
        Export
      </Button>

      {isOpen && (
        <>
          {/* Clicking anywhere else closes it. A button rather than a div so it is reachable from a
              keyboard, and aria-hidden because Escape and the choices themselves already suffice. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />

          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            <ExportChoice
              title="Excel"
              detail="For sorting, totals and re-import"
              disabled={busyWith !== null}
              busy={busyWith === "xlsx"}
              onClick={() => run("xlsx")}
            />
            <ExportChoice
              title="PDF"
              detail="For printing and filing"
              disabled={busyWith !== null}
              busy={busyWith === "pdf"}
              onClick={() => run("pdf")}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ExportChoice({
  title,
  detail,
  disabled,
  busy,
  onClick,
}: {
  title: string;
  detail: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full flex-col items-start border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-sm font-medium">{busy ? `Preparing ${title}…` : title}</span>
      <span className="text-xs text-foreground/60">{detail}</span>
    </button>
  );
}
