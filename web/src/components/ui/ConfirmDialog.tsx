"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Omitted where the title already says the whole thing — the paragraph is then not rendered at all. */
  description?: string;
  confirmLabel?: string;
  /** Text shown on the confirm button while isConfirming — defaults to matching confirmLabel's "-ing" destructive phrasing. */
  confirmingLabel?: string;
  /** "danger" (default) suits destructive actions like delete; non-destructive confirmations (e.g. generating an invoice) should pass "primary". */
  confirmVariant?: "danger" | "primary";
  isConfirming?: boolean;
  /** Blocks the confirm button while the dialog's own input is incomplete — for confirmations that also collect a value. */
  confirmDisabled?: boolean;
  /** Optional fields rendered between the description and the buttons, for confirmations that collect a value as well. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Blocking confirmation for actions worth double-checking before they happen (00_MASTER_SPEC.md § 9.5/9.11) — destructive ones by default, but reusable for any consequential action via confirmVariant. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting…",
  confirmVariant = "danger",
  isConfirming = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true">
      {/* max-h with an overflow guard rather than a fixed height: a confirmation is two lines and
          two buttons, but a server's refusal quoted inside one can run long, and the buttons have
          to stay reachable on a phone held sideways. */}
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-xl sm:p-6">
        {/* The gap under the title carries whatever the description would have: without one, the
            title needs the full space itself rather than leaving the buttons crowded against it. */}
        <h2 className={description || children ? "mb-2 text-lg font-semibold" : "mb-6 text-lg font-semibold"}>{title}</h2>
        {description && (
          <p className={children ? "mb-4 text-sm text-foreground/70" : "mb-6 text-sm text-foreground/70"}>{description}</p>
        )}
        {children && <div className="mb-6 flex flex-col gap-3">{children}</div>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isConfirming}>
            Cancel
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isConfirming || confirmDisabled}>
            {isConfirming ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
