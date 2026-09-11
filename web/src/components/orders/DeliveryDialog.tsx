"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/api/billing";
import { DateInput } from "@/components/ui/DateInput";

/** Today, in the yyyy-MM-dd that <input type="date"> speaks. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export type DeliveryPayment = { amount: number; method: PaymentMethod };

/**
 * Marks for the payment methods.
 *
 * <p>Drawn inline rather than linked. The site's CSP blocks every external host, so a hotlinked
 * logo renders as nothing at all — which is what an icon that "isn't available" looks like. These
 * carry explicit width and height as well as classes, so they have a size even before any
 * stylesheet has an opinion.</p>
 */
/**
 * Fixed colours, not currentColor: these are meant to be recognised at a glance across a counter,
 * and a mark that turns indigo when its tile is selected is no longer the mark. Mid-tone hexes, so
 * they hold up on the light surface and the dark one without a second set.
 */
const INR_GREEN = "#16A34A";
const CARD_INDIGO = "#4F46E5";
const CARD_AMBER = "#F59E0B";
const OTHER_SLATE = "#64748B";

/** A note with a rupee on it — the sign is what makes it money rather than a rectangle. */
function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" fill={INR_GREEN} fillOpacity="0.12" stroke={INR_GREEN} strokeWidth="1.5" />
      <path
        d="M9.6 9.2h4.8M9.6 11.2h4.8M13.1 9.2c1 0 1.3 2 -1 2h-.6l2.9 3.6"
        fill="none"
        stroke={INR_GREEN}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A card with its magnetic band and chip — the chip is the part people picture. */
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill={CARD_INDIGO} fillOpacity="0.12" stroke={CARD_INDIGO} strokeWidth="1.5" />
      <path d="M2.6 9.5h18.8" stroke={CARD_INDIGO} strokeWidth="2.2" />
      <rect x="5" y="12.5" width="4" height="3" rx="0.6" fill={CARD_AMBER} />
      <path d="M13 15h5" stroke={CARD_INDIGO} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

function OtherIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" fill={OTHER_SLATE} fillOpacity="0.12" stroke={OTHER_SLATE} strokeWidth="1.5" />
      <circle cx="7.6" cy="12" r="1.35" fill={OTHER_SLATE} />
      <circle cx="12" cy="12" r="1.35" fill={OTHER_SLATE} />
      <circle cx="16.4" cy="12" r="1.35" fill={OTHER_SLATE} />
    </svg>
  );
}

/**
 * The real UPI logo, served from the repo.
 *
 * <p>Everything before this was a redrawing from a screenshot, and it looked like one. This is the
 * supplied file with the page cropped away and the white made transparent, so it sits on the tile's
 * tint rather than on a white rectangle.</p>
 *
 * <p>Local rather than hotlinked, and not by preference: the site's CSP blocks external hosts
 * outright, so a linked logo would render as nothing at all.</p>
 *
 * <p>Given <c>brightness-0 invert</c> in dark mode — the wordmark's grey is chosen for white paper
 * and is close to invisible on a near-black surface. It costs the arrow its tricolour there, which
 * is the lesser loss: a mark nobody can make out is worse than a monochrome one.</p>
 */
function UpiIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/upi-logo.png"
      alt=""
      aria-hidden="true"
      // Slightly shorter than the 20px line icons: a wordmark this wide would otherwise out-weigh
      // them and pull the eye to one tile of the four.
      className="h-[15px] w-auto dark:brightness-0 dark:invert"
    />
  );
}

/**
 * How a balance gets settled at the counter.
 *
 * <p>Four of the API's five. BankTransfer is left out — a garment collected from a shop is not paid
 * for by bank transfer, and a fifth tile would narrow the row for nothing. It remains available on
 * the invoice's own page, which offers the full set.</p>
 */
const DELIVERY_METHODS: { value: PaymentMethod; Icon: () => ReactNode }[] = [
  // Cash leads because it is both the commonest and the default — the selected tile sitting first
  // means the eye starts where the answer usually already is.
  { value: "Cash", Icon: CashIcon },
  { value: "Upi", Icon: UpiIcon },
  { value: "Card", Icon: CardIcon },
  { value: "Other", Icon: OtherIcon },
];

/**
 * Handing an order over: the date, what it is worth, and the money still owed, in one dialog.
 *
 * <p>The balance is collected here rather than as a step of its own. The server refuses delivery
 * while an invoice still has anything outstanding, so the two always happened together anyway —
 * asking the counter to take payment on one screen and then deliver on another was one handover
 * charged as two jobs.</p>
 *
 * <p>Mounted only while it is open (the parents render it conditionally), so its fields start from
 * the order in front of the reader and no effect is needed to reset them between rows.</p>
 */
export function DeliveryDialog({
  orderNumber,
  customerName,
  orderTotal,
  taxAmount,
  taxRatePercent,
  invoiceTotal,
  advancePaid,
  outstanding,
  willRaiseInvoice,
  isConfirming,
  error,
  onConfirm,
  onCancel,
}: {
  orderNumber: string;
  customerName: string;
  /** The garments, before tax. */
  orderTotal: number;
  taxAmount: number;
  /** Named on the tax line, so the figure beside it isn't an unexplained addition. */
  taxRatePercent: number;
  invoiceTotal: number;
  advancePaid: number;
  /** What has to be collected before this order can be handed over. */
  outstanding: number;
  /**
   * True when the order has never been invoiced and confirming will raise one.
   *
   * <p>Order RT-0003 reached Ready for Delivery with no invoice at all, so an earlier version of
   * this dialog read "Nothing outstanding" over a row saying 130.00 was owed — and confirming would
   * have handed the garment over with the money uncollected and nothing ever billed. The server
   * allows that: it refuses delivery on an unpaid <em>invoice</em>, and an order without one owes
   * nothing by that measure.</p>
   */
  willRaiseInvoice: boolean;
  isConfirming: boolean;
  error: string | null;
  /** `payment` is null when there was nothing to collect. */
  onConfirm: (deliveredAtUtc: string, payment: DeliveryPayment | null) => void;
  onCancel: () => void;
}) {
  const [deliveryDate, setDeliveryDate] = useState(todayIsoDate());
  // Held as text so a half-typed figure isn't rewritten under the cursor.
  const [received, setReceived] = useState(outstanding > 0 ? outstanding.toFixed(2) : "");
  const [method, setMethod] = useState<PaymentMethod>("Cash");

  const owes = outstanding > 0;
  const amount = Number(received);
  const isAmountValid = Number.isFinite(amount) && amount >= 0;
  const remaining = isAmountValid ? outstanding - amount : outstanding;
  // The server refuses delivery on anything short of the full balance, so the dialog does too —
  // a part payment recorded against a refused delivery is money taken for a garment still on the rack.
  const isCleared = isAmountValid && remaining <= 0;

  return (
    <Modal
      open
      title="Confirm Delivery"
      icon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M6 2h12l1 5H5l1-5Z" />
          <path d="M5 7h14v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" />
          <path d="m9 13 2 2 4-4" />
        </svg>
      }
      onClose={onCancel}
    >
      {/* Back to the standard dialog width. It was widened when this screen carried a subtitle, a
          "balance cleared" panel, a footer note and a stacked amount field; with those gone the
          content fits without borrowing the extra space. */}
      <div className="flex flex-col gap-3">
        {/* Which order, and whose — the two things worth confirming before money changes hands. */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
          <Fact label="Order No." value={<span className="font-mono text-primary">{orderNumber}</span>} />
          <Fact label="Customer" value={customerName} />
        </div>

        {/* What the order is worth on the left, what is being done about it on the right. The date
            moved across to join the payment because both are things the reader fills in, and the
            summary is the only panel here that is purely read. */}
        {/* Not an even split. Order Summary is five label-and-figure rows and needs only enough
            width to hold "Order Total" beside a price; the payment side has four tiles across and
            takes everything else. An equal split left the summary padded with air. */}
        <div className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
          {/* Rows given a little room to breathe. Packed tight they read as one block of figures
              rather than five separate facts, and the two that matter — Invoice Total and Balance
              Due — stopped standing out from the three that lead to them. */}
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3.5">
            <SectionHeading>Order Summary</SectionHeading>

            {/* The arithmetic in full. An order about to be invoiced gains tax it has never
                carried, and a dialog that simply asserted the larger figure read as though it
                disagreed with the Balance column one screen away. */}
            <Row label="Order Total" value={money(orderTotal)} />
            <Row label={`Tax (${taxRatePercent}%)`} value={money(taxAmount)} />
            <div className="border-t border-border pt-1.5">
              <Row label="Invoice Total" value={money(invoiceTotal)} strong />
            </div>
            <Row label="Advance Paid" value={money(advancePaid)} />

            <div className="flex items-baseline justify-between rounded-md bg-warning/10 px-2 py-1.5 text-sm font-semibold">
              <span>Balance Due</span>
              <span className="tabular-nums text-danger">{money(Math.max(outstanding, 0))}</span>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border border-border p-3.5">
              <SectionHeading>Delivery Date</SectionHeading>
              {/* A late-entered handover keeps the day it happened, so this is editable rather
                  than stamped with now. */}
              <DateInput
                id="deliveryDate"
                value={deliveryDate}
                onChange={setDeliveryDate}
                disabled={isConfirming}
              />
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
              <SectionHeading>Payment Details</SectionHeading>

              {owes ? (
                <>
                  {/* Label and field on one line, so this row reads the same way as the Remaining
                      Balance line beneath it — a caption above a box would have been the only
                      stacked field in a panel of side-by-side figures. */}
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="receivedBalance" className="text-sm font-medium leading-tight">
                      Payment Received Now <span className="text-danger">*</span>
                    </label>
                    {/* Pre-filled with the whole balance, which is what happens at a counter nearly
                        every time — a figure to glance at rather than type. */}
                    <div className="flex w-36 shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
                      <span aria-hidden="true" className="flex items-center bg-background/60 px-2 text-sm text-foreground/60">
                        ₹
                      </span>
                      <input
                        id="receivedBalance"
                        type="number"
                        min="0"
                        step="0.01"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                        disabled={isConfirming}
                        className="w-full bg-transparent px-2 py-2 text-right text-sm tabular-nums outline-none"
                      />
                    </div>
                  </div>

                  {/* Same width and the same inset as the field above, so the two figures share a
                      right edge. Flush against the panel they were nine pixels apart — the input's
                      border and padding — which is exactly enough to look like a mistake. */}
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground/70">Remaining Balance</span>
                    <span
                      className={`w-36 shrink-0 pr-[9px] text-right font-medium tabular-nums ${
                        isCleared ? "text-success" : "text-danger"
                      }`}
                    >
                      {money(Math.max(remaining, 0))}
                    </span>
                  </div>

                  {/* Radios rather than checkboxes: a payment is recorded with one method, and two
                      ticked boxes would describe a split the API has no way to take. */}
                  <fieldset className="flex flex-col gap-2" disabled={isConfirming}>
                    <legend className="text-sm font-medium">
                      Payment Method <span className="text-danger">*</span>
                    </legend>
                    {/* Four across, each stacking mark over label over control. The whole tile is
                        the label, so the tap target is the card rather than the dot inside it —
                        which is what makes this quicker than the dropdown it replaced. */}
                    <div className="grid grid-cols-4 gap-2">
                      {DELIVERY_METHODS.map(({ value, Icon }) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-xs transition-colors ${
                            method === value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-foreground/70 hover:bg-surface-hover"
                          }`}
                        >
                          {/* A fixed slot, not each icon minding its own height. The three SVGs are
                              20px tall and the UPI logo is a wide, short wordmark, so letting the
                              marks size the row left one tile's label and radio riding higher than
                              its neighbours'. Centring inside a common box lines all four up. */}
                          <span className="flex h-5 items-center justify-center">
                            <Icon />
                          </span>
                          <span className="leading-none">{paymentMethodLabel(value)}</span>
                          <input
                            type="radio"
                            name="deliveryPaymentMethod"
                            value={value}
                            checked={method === value}
                            onChange={() => setMethod(value)}
                            // accent-primary so the selected dot is the app's own colour rather than
                            // the browser's default blue, which reads as a different product in dark mode.
                            className="h-3.5 w-3.5 accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {!isCleared && (
                    <p className="text-sm text-danger">
                      Delivery needs the full {money(outstanding)}. To take part of it, use Balance on
                      the order instead and deliver once it is settled.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-foreground/70">No outstanding on this order.</p>
              )}
            </section>

            {/* Sits with the payment now rather than under the summary: it is a remark about the
                figure just typed, so it belongs beside the field that produced it. */}
            {owes && remaining < 0 && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                {money(-remaining)} more than the balance — it will be recorded as paid.
              </p>
            )}
          </div>
        </div>

        {/* Said plainly rather than done quietly. Raising an invoice issues a numbered document to
            a customer, so it is not something to discover afterwards — but it is also the only way
            the money can be recorded, so it happens here rather than as an errand. */}
        {willRaiseInvoice && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            An invoice will be raised on confirmation and this payment recorded against it.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {/* The standing footer note is gone: "Delivery, invoice and payment will be recorded" said
            what the banner above already says, and on a laptop it was the line that tipped the
            dialog into scrolling. */}
        <div className="flex justify-end gap-3 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isConfirming || deliveryDate === "" || (owes && !isCleared)}
            onClick={() => onConfirm(new Date(`${deliveryDate}T00:00:00Z`).toISOString(), owes ? { amount, method } : null)}
          >
            {isConfirming ? "Completing…" : "Complete Delivery"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-foreground/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? undefined : "text-foreground/70"}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
