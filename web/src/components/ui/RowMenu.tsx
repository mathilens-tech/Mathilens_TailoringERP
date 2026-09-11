"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  /** Kept visible but unselectable, with `reason` saying why — see the note on the component. */
  disabled?: boolean;
  /** Why this item can't be chosen. Shown under the label, so the answer is on screen rather than in a tooltip. */
  reason?: string;
  variant?: "default" | "danger";
};

/** Roughly what one item occupies, used only to decide whether the menu opens downwards. */
const ITEM_HEIGHT = 44;
const MENU_PADDING = 16;
const GAP = 4;

/**
 * The overflow menu on a table row.
 *
 * <p>Every row has one, in the same place, whatever state the record is in — which is the point.
 * The actions that vary are inside it, so the column itself never changes shape and the eye can
 * find the control without reading the row first.</p>
 *
 * <p>Unavailable actions stay in the list, greyed, each with a line saying why. A menu whose
 * contents shift between rows is the ragged column again, one level down; and "Balance,
 * nothing outstanding" answers the question a reader would otherwise have to work out.</p>
 *
 * <p>Rendered into the body rather than in place: the table sits in an <c>overflow-x-auto</c>
 * wrapper, which clips vertically as well, so a menu positioned inside it would be cut off at the
 * last row. Fixed to the trigger's rectangle and closed on scroll — no reflow to track.</p>
 */
export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setAnchor(null), []);

  function toggle() {
    if (anchor) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({ top: rect.top, bottom: rect.bottom, right: rect.right });
    }
  }

  useEffect(() => {
    if (!anchor) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    // pointerdown rather than click: closing on the way down means the click that dismisses the
    // menu doesn't also land on whatever was underneath it.
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close();
      }
    }

    // Closed rather than repositioned. The menu is fixed to a rectangle read once, so anything that
    // moves that rectangle would leave it pointing at the wrong row.
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor, close]);

  // Opens upwards near the foot of the window, so the last row's menu isn't half off-screen.
  const estimatedHeight = items.length * ITEM_HEIGHT + MENU_PADDING;
  const opensDown = anchor === null || anchor.bottom + estimatedHeight <= window.innerHeight;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={label}
        className="rounded-md px-2 py-1 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {anchor !== null &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{
              position: "fixed",
              right: window.innerWidth - anchor.right,
              ...(opensDown ? { top: anchor.bottom + GAP } : { bottom: window.innerHeight - anchor.top + GAP }),
            }}
            className="z-50 min-w-[13rem] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors ${
                  item.disabled
                    ? "cursor-not-allowed text-foreground/40"
                    : item.variant === "danger"
                      ? "text-danger hover:bg-surface-hover"
                      : "hover:bg-surface-hover"
                }`}
              >
                <span>{item.label}</span>
                {item.disabled && item.reason && <span className="text-xs text-foreground/40">{item.reason}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
