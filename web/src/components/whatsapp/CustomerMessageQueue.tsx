"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { createManualWhatsAppProvider, WhatsAppOpenError, type WhatsAppApp } from "@/lib/whatsapp/provider";
import { toWhatsAppNumber } from "@/lib/whatsapp/whatsapp-service";
import { renderTemplate } from "@/lib/whatsapp/templates";
import type { Customer } from "@/lib/api/customers";
import { toDisplayPhoneNumber } from "@/lib/contact";

/**
 * Sending one message to many customers, with the shop pressing Send each time.
 *
 * <p><b>This is not a WhatsApp broadcast.</b> Nothing is dispatched on the shop's behalf: delivery
 * here is the same Click-to-Chat hand-off every other WhatsApp button in this app uses, which opens
 * the app with the text already typed. A real broadcast needs the Business API, an approved
 * template for anything promotional, and a Meta account — `MetaWhatsAppSender` exists on the server
 * for the day that is set up, and this screen is written so that day changes the `deliver` call and
 * nothing else.</p>
 *
 * <p>So the honest shape is a worklist, and it is built as one. Each customer is opened by its own
 * press, for two reasons: a loop calling window.open is stopped by the pop-up blocker after the
 * first one, and more importantly a queue that fires thirty tabs is a queue nobody can follow. The
 * shop sees who is next, who is done, and who was skipped.</p>
 */
export function CustomerMessageQueue({
  customers,
  template,
  shopName,
  whatsAppApp,
  onClose,
}: {
  customers: Customer[];
  /** The shop's configured draft, tokens unsubstituted. */
  template: string;
  shopName: string;
  whatsAppApp: WhatsAppApp;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const provider = useMemo(() => createManualWhatsAppProvider(whatsAppApp), [whatsAppApp]);

  /**
   * Everyone who cannot be messaged at all, worked out once up front rather than discovered one at
   * a time. A number WhatsApp cannot use is not a failure to retry — it is a customer record to go
   * and fix — so they are named here instead of interrupting the run thirty entries in.
   */
  const unreachable = useMemo(
    () => customers.filter((c) => toWhatsAppNumber(c.phoneNumber) === null),
    [customers],
  );
  const reachable = useMemo(
    () => customers.filter((c) => toWhatsAppNumber(c.phoneNumber) !== null),
    [customers],
  );

  const current = reachable[index] ?? null;
  const isDone = current === null;

  const message = current
    ? renderTemplate(template, { "{customerName}": current.fullName, "{shopName}": shopName })
    : "";

  async function openCurrent() {
    if (!current) {
      return;
    }
    const number = toWhatsAppNumber(current.phoneNumber);
    if (number === null) {
      return;
    }

    setError(null);
    try {
      // Awaited inside the click that triggered it, so the browser still counts this as a user
      // gesture when the tab is opened. Anything asynchronous between the press and the open —
      // fetching the template, for instance — is what turns this into a blocked pop-up, which is
      // why the template is a prop and not loaded here.
      await provider.deliver(number, message);
      setSent((previous) => new Set(previous).add(current.id));
      setIndex((previous) => previous + 1);
    } catch (openError) {
      setError(
        openError instanceof WhatsAppOpenError
          ? openError.message
          : "Unable to open WhatsApp for this customer.",
      );
    }
  }

  function skipCurrent() {
    if (!current) {
      return;
    }
    setSkipped((previous) => new Set(previous).add(current.id));
    setIndex((previous) => previous + 1);
    setError(null);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send WhatsApp message"
      description={`${reachable.length} customer${reachable.length === 1 ? "" : "s"} to message`}
    >
      <div className="flex flex-col gap-4">
        {unreachable.length > 0 && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {unreachable.length} selected customer{unreachable.length === 1 ? " has" : "s have"} no usable
            WhatsApp number and {unreachable.length === 1 ? "is" : "are"} not included:{" "}
            <span className="text-foreground/70">{unreachable.map((c) => c.fullName).join(", ")}</span>
          </p>
        )}

        {isDone ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Finished.</p>
            <p className="text-sm text-foreground/70">
              Opened for {sent.size} customer{sent.size === 1 ? "" : "s"}
              {skipped.size > 0 && `, skipped ${skipped.size}`}.
            </p>
            {/* Said plainly, because the difference matters if anybody is counting this as a
                campaign: the tab opening is not the message arriving. */}
            <p className="text-xs text-foreground/60">
              Opening WhatsApp is not the same as delivery — each message is sent when you press Send
              in WhatsApp itself.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                {current.fullName}
                <span className="ml-2 font-normal text-foreground/60">
                  {toDisplayPhoneNumber(current.phoneNumber)}
                </span>
              </span>
              <span className="text-xs text-foreground/60">
                {index + 1} of {reachable.length}
              </span>
            </div>

            {/* The exact string being handed over, not a rendering of it — the asterisks are what
                WhatsApp turns into bold at the other end. Read-only: editing one copy of a message
                going to thirty people is a per-customer edit, which is what the single-customer
                icon on each row is for. */}
            <textarea
              readOnly
              rows={10}
              value={message}
              aria-label={`Message for ${current.fullName}`}
              className="w-full resize-none rounded-md border border-border bg-surface-hover px-3 py-2 font-mono text-xs outline-none"
            />

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <ModalActions>
        {isDone ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={skipCurrent}>
              Skip
            </Button>
            <Button type="button" onClick={openCurrent}>
              Open WhatsApp
            </Button>
          </>
        )}
      </ModalActions>
    </Modal>
  );
}
