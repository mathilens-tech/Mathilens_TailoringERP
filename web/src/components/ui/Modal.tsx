"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Where a dialog's own controls land when they belong beside the title rather than under the
 * fields — see <see cref="ModalActions"/>'s `placement="header"`.
 *
 * A context carrying a DOM node, so a form nested anywhere inside the body can put its buttons in
 * the header without the dialog's caller having to lift the form's state (is it submitting? is it
 * valid?) up to pass them in. Null outside a Modal, which is what lets the same form render its
 * buttons ordinarily on a full page.
 */
const ModalHeaderSlotContext = createContext<HTMLElement | null>(null);

/**
 * A dialog for a form, as opposed to <see cref="ConfirmDialog"/>'s single question.
 *
 * Sized to fit rather than to scroll. The forms inside lay their fields out in two columns from the
 * small breakpoint up, so a nine-field customer form is five rows deep and lands well inside a
 * laptop screen with nothing to scroll. `max-h`/`overflow-y-auto` on the body is a guard, not the
 * plan: on a phone held sideways, or with the browser's text scaled up, something has to give, and
 * the alternative to an occasional scroll is a Submit button nobody can reach.
 *
 * dvh rather than vh throughout — on a phone, vh is measured against the viewport with the address
 * bar retracted, so a dialog sized in vh is taller than what is actually on screen.
 */
export function Modal({
  open,
  title,
  description,
  icon,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  /** Optional mark beside the title, for dialogs that carry one. Purely decorative. */
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // Held as state rather than a ref so that a form rendering into it re-renders once the node
  // exists — a ref would still be null on the first pass and the buttons would never appear.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  // Escape closes it, and the page behind stops scrolling while it is open — otherwise a flick on a
  // tablet scrolls the list underneath and the form appears to jump.
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4">
      {/* A button rather than a div so dismissing by clicking away is reachable from a keyboard too;
          it is aria-hidden because the same escape is already on Escape and the Cancel control. */}
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="fixed inset-0 -z-10 cursor-default" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-panel flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl ring-1 ring-black/5 sm:max-h-[92dvh]"
      >
        {/* Centred rather than top-aligned: with no description the title is a single line, and an
            icon and a close button hanging from the top of a one-line header sit visibly high.

            Tinted a shade off the body so the header reads as a bar the dialog's controls belong to
            rather than as the first row of the form. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-hover/40 px-3 py-2 sm:gap-3 sm:px-5 sm:py-2.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {icon && (
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
              {description && <p className="mt-0.5 truncate text-sm text-foreground/70">{description}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* display:contents, so buttons portalled in here become flex children of this row
                itself and are spaced by its gap — rather than sitting in a box of their own whose
                spacing would have to be kept in step with the close button's by hand. */}
            <div ref={setHeaderSlot} className="contents" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 shrink-0 rounded-lg p-1.5 text-foreground/50 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-2"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <ModalHeaderSlotContext.Provider value={headerSlot}>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">{children}</div>
        </ModalHeaderSlotContext.Provider>
      </div>
    </div>
  );
}

/**
 * The row of controls that closes every form dialog: Cancel on the left, Submit on the right.
 *
 * Shared rather than written per form so the two words, the order and the spacing are the same
 * wherever a dialog asks for something — the pair is the part of a dialog people learn by position
 * rather than by reading. Full width and side by side on a phone, so neither is a small target.
 *
 * `placement="top"` puts the pair above the fields instead of below them, for forms long enough
 * that on a phone the bottom of the form is off screen — Submit is the one control that must never
 * be somewhere you have to go looking for.
 *
 * `placement="header"` goes one further and puts them on the title's own line, beside the close
 * button, where they cost the form no height at all. Two things follow from that:
 *
 * - The buttons leave the form's DOM subtree, so a `type="submit"` among them **must** carry a
 *   `form="<id>"` naming the form it belongs to. Without it the browser has no form to submit and
 *   the button does nothing. (React state and context still flow normally — a portal moves the DOM
 *   node, not the component tree.)
 * - Outside a Modal there is no header to move them to, so it falls back to `"top"` — which is what
 *   lets the same form serve both a dialog and a full page.
 */
export function ModalActions({
  children,
  placement = "bottom",
}: {
  children: ReactNode;
  placement?: "top" | "bottom" | "header";
}) {
  const headerSlot = useContext(ModalHeaderSlotContext);

  if (placement === "header" && headerSlot) {
    return createPortal(children, headerSlot);
  }

  return (
    <div
      className={
        placement === "bottom"
          ? "mt-5 flex items-center justify-end gap-3 border-t border-border pt-4"
          : "mb-3 flex items-center justify-end gap-3 border-b border-border pb-3"
      }
    >
      {children}
    </div>
  );
}
