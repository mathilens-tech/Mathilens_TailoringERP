"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";
import { requestOrderAlteration, type Order } from "@/lib/api/orders";

/** The reason column's limit — OrderAlteration.ReasonMaxLength on the server. */
const REASON_MAX_LENGTH = 1000;

function money(amount: number): string {
  return amount.toFixed(2);
}

function onlyDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * Taking a delivered garment back, and the record of every time it has happened.
 *
 * WHY THIS IS NOT A "MARK AS…" BUTTON. Every other move through the workflow is a single click,
 * because every other move says all there is to say. An alteration does not: the garment came back
 * for a reason, and the reason is the only part anyone reads afterwards. So it asks, and the asking
 * is why Delivered lists no next status on the page even though the server now allows one.
 *
 * The charge is offered and defaults to nothing. Re-stitching the shop's own work is not billable —
 * but a customer who changed their mind about a fit they approved may well be charged, and a shop
 * that could not record that would raise a second order to collect it, which is the workaround this
 * whole state exists to remove.
 */
export function AlterationSection({
  order,
  onOrderChanged,
}: {
  order: Order;
  onOrderChanged: (order: Order) => void;
}) {
  const { showToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [charge, setCharge] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canRequest = order.status === "Delivered";
  const hasHistory = order.alterations.length > 0;

  // Nothing to show and nothing to offer: the overwhelming majority of orders, which should not
  // carry an empty card about a thing that has not happened to them.
  if (!canRequest && !hasHistory) {
    return null;
  }

  async function submit() {
    if (reason.trim() === "") {
      showToast("Say what needs altering.", "error");
      return;
    }

    // Blank means free, which is the common case — so an empty box is an answer, not an omission.
    const chargeAmount = charge.trim() === "" ? 0 : Number(charge);
    if (!Number.isFinite(chargeAmount) || chargeAmount < 0) {
      showToast("A charge cannot be negative.", "error");
      return;
    }

    setIsSaving(true);
    try {
      onOrderChanged(await requestOrderAlteration(order.id, reason.trim(), chargeAmount, getAccessToken()));
      showToast("Order taken back for alteration.");
      setIsDialogOpen(false);
      setReason("");
      setCharge("");
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Alterations</h2>
        {canRequest && (
          <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(true)}>
            Take Back for Alteration
          </Button>
        )}
      </div>

      {hasHistory ? (
        <ol className="flex flex-col gap-3">
          {order.alterations.map((alteration, index) => (
            <li key={alteration.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {index + 1}. {alteration.reason}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/60">
                    Taken back {onlyDate(alteration.createdAtUtc)}
                    {alteration.previousDeliveredAtUtc && (
                      <> · delivered {onlyDate(alteration.previousDeliveredAtUtc)}</>
                    )}
                  </p>
                </div>
                {/* Said plainly either way. "Free" is a decision the shop made and may be asked
                    about later; a blank space is not. */}
                <span
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    alteration.chargeAmount > 0 ? "text-primary" : "text-foreground/60"
                  }`}
                >
                  {alteration.chargeAmount > 0 ? money(alteration.chargeAmount) : "Free"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-foreground/70">
          This order has not been altered. If the fit is wrong, take it back and the order reopens so the measurements
          and cloth can be corrected.
        </p>
      )}

      <Modal
        open={isDialogOpen}
        title="Take back for alteration"
        description={`Order ${order.orderNumber}`}
        onClose={() => setIsDialogOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">What needs altering?</span>
            <textarea
              rows={3}
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Sleeve too long, tight at the waist…"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <span className="text-xs text-foreground/60">In the customer&rsquo;s own words, if you can.</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Charge (optional)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
              placeholder="0.00"
              className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <span className="text-xs text-foreground/60">
              Leave blank for a free rework, which is the usual case.
            </span>
          </label>

          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            The order reopens at <strong>Alteration</strong>, so its garments, cloth and measurements can be changed
            again. Its delivery date is kept until the altered garment is handed over.
          </p>

          <ModalActions>
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Cancel
            </button>
            <Button type="button" disabled={isSaving} onClick={submit}>
              {isSaving ? "Taking back…" : "Take Back"}
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </div>
  );
}
