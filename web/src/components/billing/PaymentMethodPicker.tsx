"use client";

import { paymentMethodLabel, type PaymentMethod } from "@/lib/api/billing";

/**
 * The ways this shop is actually handed money, in the order it is asked for at the counter.
 *
 * <p>A subset of the server's PaymentMethod, and deliberately so: Bank Transfer is a method the API
 * still accepts and still shows on any payment already recorded under it, but nobody at a tailoring
 * counter settles a bill that way, and a tile nobody presses is a tile in the way of the three they
 * do. Adding it back is one line.</p>
 */
export const OFFERED_PAYMENT_METHODS: readonly PaymentMethod[] = ["Cash", "Upi", "Card", "Other"];

/**
 * How the money came in, as a row of choices rather than a dropdown.
 *
 * <p>A dropdown hides all but one of its options until it is opened, and at a counter the method is
 * decided by what the customer is already holding — a note, a card, a phone. Laying them out means
 * the answer is one tap on the one that matches, with no reading step in between.</p>
 *
 * <p>One list for every screen that takes money, so the same four are offered wherever a payment is
 * recorded and none of them has to be kept in step by hand.</p>
 */
export function PaymentMethodPicker({
  value,
  onChange,
  disabled = false,
  /** Set on the group so a screen with more than one money field stays unambiguous to assistive tech. */
  label = "Payment method",
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    // radiogroup rather than a row of buttons: this is one choice among several, and a screen
    // reader should announce it as "2 of 4" rather than as four unrelated controls.
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {OFFERED_PAYMENT_METHODS.map((method) => {
        const isSelected = value === method;
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(method)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                : "border-border bg-surface text-foreground/70 hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <PaymentMethodIcon method={method} className="h-5 w-5" />
            {/* The shop's own words — "UPI" and "Others", not the enum's Upi/Other. */}
            <span className="text-xs font-medium leading-tight">{method === "Other" ? "Others" : paymentMethodLabel(method)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Drawn inline in the same stroked style as the nav's icons — a few glyphs is not a dependency.
 *  BankTransfer keeps its glyph: it is off the picker, not out of the type, and a screen that lists
 *  an existing payment still has to draw it. */
function PaymentMethodIcon({ method, className }: { method: PaymentMethod; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (method) {
    case "Cash":
      // A note with a coin on it.
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "Card":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </svg>
      );
    case "Upi":
      // A phone with a payment arrow — how a UPI payment is actually made.
      return (
        <svg {...common}>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M10 6h4M12 10v6M12 16l-2-2M12 16l2-2" />
        </svg>
      );
    case "BankTransfer":
      return (
        <svg {...common}>
          <path d="M3 10h18L12 4 3 10Z" />
          <path d="M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18" />
        </svg>
      );
    default:
      // Other — an ellipsis, which is what it means.
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
