"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { recordWhatsAppShareOpened } from "@/lib/api/whatsapp";
import {
  buildInvoiceMessage,
  buildReadyMessage,
  buildDeliveredMessage,
  shareInvoice,
  toWhatsAppNumber,
  SHARE_BLOCKED_MESSAGES,
  type ShareBlockedReason,
  type ShareKind,
} from "@/lib/whatsapp/whatsapp-service";
import { createManualWhatsAppProvider, toWhatsAppApp } from "@/lib/whatsapp/provider";

/**
 * What this button needs to share one invoice. All of it comes from records the calling screen has
 * already loaded, so opening the preview costs no round trip.
 */
export type ShareViaWhatsAppProps = {
  /** null while no customer is chosen — the button says so rather than disappearing. */
  customer: { id: string; fullName: string; phoneNumber: string } | null;
  /** null until an invoice exists. Sharing is blocked, not hidden, so the reason can be given. */
  invoice: { id: string; invoiceNumber: string; totalAmount: number; amountPaid: number; remainingBalance: number } | null;
  order: { orderNumber: string; dueAtUtc: string };
  shopName: string;
  /**
   * The stored `WhatsApp.PreferredApp` setting, passed raw and read here — same as `shopName`, and
   * for the same reason: this component is handed the shop's settings rather than fetching them.
   * Anything unset or unrecognised means the default, so a blank is not an error.
   */
  whatsAppApp?: string;
  /**
   * Which message to send. Defaults to the invoice, which is what this button did before there was
   * anything else to send.
   */
  kind?: ShareKind;
  variant?: "primary" | "secondary";
};

/**
 * What each button says it will do.
 *
 * Three of these can appear on one order page at once, so "Share via WhatsApp" three times over
 * would be three buttons asking to be tried to find out which is which. The label names the
 * message; the glyph says where it goes.
 */
const BUTTON_LABELS: Record<ShareKind, string> = {
  invoice: "Share via WhatsApp",
  ready: "Tell customer it's ready",
  delivered: "Send a thank-you",
};

/** The line under the dialog title, so the preview says which of the three is being previewed. */
const MODAL_DESCRIPTIONS: Record<ShareKind, string> = {
  invoice: "Check the message, then open WhatsApp and press Send there.",
  ready: "Tells the customer their order is ready to collect. Check it, then send from WhatsApp.",
  delivered: "Thanks the customer for a completed order. Check it, then send from WhatsApp.",
};

/** WhatsApp's own glyph, drawn inline — one icon is not worth a dependency. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.34 4.95L2 22l5.23-1.37a9.9 9.9 0 0 0 4.81 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.36c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 0 16.45Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12s-.64.8-.79.97c-.14.16-.29.18-.54.06a6.7 6.7 0 0 1-3.35-2.93c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.43-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.15 3.66 1.54.67 2.15.72 2.92.61.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

/**
 * Share via WhatsApp — Click-to-Chat, opened in a new tab, sent by hand.
 *
 * <p>Nothing is dispatched from here. The button assembles the message from the order and invoice,
 * shows it, and hands it to WhatsApp with the customer's number already filled in; a person then
 * presses Send. So no screen anywhere claims a message was delivered, and the trail records a share
 * being started rather than a message being sent.</p>
 *
 * <p>One component for all four places this appears (after Create Order, after Generate Invoice, on
 * the order page and on the invoice page) so the message reads identically wherever it is sent
 * from, and the rules about a missing number or a missing invoice are stated once.</p>
 */
export function ShareViaWhatsAppButton({
  customer,
  invoice,
  order,
  shopName,
  whatsAppApp,
  kind = "invoice",
  variant = "secondary",
}: ShareViaWhatsAppProps) {
  const { showToast } = useToast();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [message, setMessage] = useState("");

  const whatsAppNumber = toWhatsAppNumber(customer?.phoneNumber);

  /**
   * The first thing standing in the way, or null when the share can go ahead.
   *
   * A missing invoice only blocks the invoice message. Telling somebody their clothes are ready
   * does not depend on having billed them yet — the message simply leaves the money line out.
   */
  const blockedBy: ShareBlockedReason | null = !customer
    ? "no-customer"
    : !customer.phoneNumber?.trim()
      ? "no-phone-number"
      : whatsAppNumber === null
        ? "invalid-phone-number"
        : !invoice && kind === "invoice"
          ? "no-invoice"
          : null;

  function handleOpenPreview() {
    // Stated rather than silently ignored: a button that does nothing when pressed sends staff
    // looking for a broken feature instead of a missing phone number.
    if (blockedBy) {
      showToast(SHARE_BLOCKED_MESSAGES[blockedBy], "error");
      return;
    }
    if (!customer) {
      return;
    }

    // Composed from what is already on screen — no round trip. The invoice message used to carry a
    // link to the read-only invoice page, which meant fetching a share token first and a failure
    // path when that did not come back; it carries no link now, so there is nothing left to fetch
    // and nothing left to fail. The page and its token endpoint still exist for when a link is
    // wanted again.
    const shop = { name: shopName };

    if (kind === "invoice") {
      if (!invoice) {
        return;
      }

      setMessage(
        buildInvoiceMessage(
          {
            customerName: customer.fullName,
            customerPhoneNumber: customer.phoneNumber,
            orderNumber: order.orderNumber,
            invoiceNumber: invoice.invoiceNumber,
            orderTotal: invoice.totalAmount,
            advancePaid: invoice.amountPaid,
            balanceDue: invoice.remainingBalance,
            collectionDateUtc: order.dueAtUtc,
          },
          shop,
        ),
      );
    } else {
      const status = {
        customerName: customer.fullName,
        orderNumber: order.orderNumber,
        // null, not 0, when there is no invoice to read a balance from — the message treats the
        // two differently, and "nothing owed" is not the same claim as "nothing billed yet".
        balanceDue: invoice?.remainingBalance ?? null,
        collectionDateUtc: order.dueAtUtc,
      };

      setMessage(kind === "ready" ? buildReadyMessage(status, shop) : buildDeliveredMessage(status, shop));
    }

    setIsPreviewOpen(true);
  }

  async function handleOpenWhatsApp() {
    if (!whatsAppNumber || !customer) {
      return;
    }

    setIsOpening(true);
    try {
      // Opened first, and from the click that asked for it: a browser only allows window.open
      // during a user gesture, and awaiting the activity record beforehand would spend that gesture
      // and get the tab blocked.
      await shareInvoice(
        whatsAppNumber,
        message,
        createManualWhatsAppProvider(toWhatsAppApp(whatsAppApp)),
      );
      setIsPreviewOpen(false);

      // Best effort, and after the fact. A trail entry that failed to write is not a reason to tell
      // someone their share did not happen — it plainly did, in the tab that just opened.
      recordWhatsAppShareOpened(
        {
          customerId: customer.id,
          orderNumber: order.orderNumber,
          // Blank on a status share with nothing billed yet. The field is the invoice's own
          // reference, and inventing one to fill it would put a number in the trail that names no
          // invoice — the order number is what makes the row followable either way.
          invoiceNumber: invoice?.invoiceNumber ?? "",
        },
        getAccessToken(),
      ).catch(() => {});
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to open WhatsApp. Please try again.",
        "error",
      );
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={handleOpenPreview}>
        <span className="flex items-center gap-2">
          {/* The glyph keeps WhatsApp's own green — it names another application, and this is the
              one place the ERP's palette should step aside. The button itself stays in theme. */}
          <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
          {BUTTON_LABELS[kind]}
        </span>
      </Button>

      <Modal
        open={isPreviewOpen}
        title="Share via WhatsApp"
        description={MODAL_DESCRIPTIONS[kind]}
        onClose={() => setIsPreviewOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground/70">Customer</span>
              <span className="text-sm font-medium">{customer?.fullName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground/70">WhatsApp</span>
              <span className="text-sm font-medium tabular-nums">
                {toDisplayPhoneNumber(customer?.phoneNumber)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="whatsAppMessage" className="text-sm font-medium">
              Message
            </label>
            {/* Editable, and what is sent is exactly what is on screen — the textarea's value is the
                string handed to the provider, so there is no second rendering to drift from it. */}
            <textarea
              id="whatsAppMessage"
              rows={14}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setIsPreviewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleOpenWhatsApp} disabled={isOpening || message.trim() === ""}>
              {isOpening ? "Opening…" : "Open WhatsApp"}
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </>
  );
}
