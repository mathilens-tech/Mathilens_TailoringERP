export type BadgeTone = "neutral" | "info" | "warning" | "primary" | "success" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-foreground/8 text-foreground/70",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

type StatusBadgeProps = {
  label: string;
  tone: BadgeTone;
};

/** A colored pill for order/invoice/employee statuses — color is always paired with the status label text, never the only signal (00_MASTER_SPEC.md § 9.3 Accessibility). */
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

/**
 * The one place an order status is turned into words.
 *
 * Title case throughout: the shop asked for "Ready For Delivery" specifically, and leaving its
 * neighbour as "In progress" would have read as a mistake in the same dropdown.
 */
export const ORDER_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  Received: { label: "Received", tone: "info" },
  InProgress: { label: "In Progress", tone: "warning" },
  ReadyForDelivery: { label: "Ready For Delivery", tone: "primary" },
  Delivered: { label: "Delivered", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
  // Cloth sold over the counter. Green like Delivered, because it is finished for the same reason:
  // the customer has what they came for. This map is Record<string>, so without an entry "Sold"
  // would still read correctly but arrive with no tone at all.
  Sold: { label: "Sold", tone: "success" },
};

/** The words for a status, falling back to the raw value so an unmapped one is visible, not blank. */
export const orderStatusLabel = (status: string) => ORDER_STATUS_BADGE[status]?.label ?? status;

export const INVOICE_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  Unpaid: { label: "Unpaid", tone: "danger" },
  PartiallyPaid: { label: "Partially paid", tone: "warning" },
  Paid: { label: "Paid", tone: "success" },
  Void: { label: "Void", tone: "neutral" },
};
