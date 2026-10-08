"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useRouteId } from "@/lib/use-route-id";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import { useToast } from "@/components/ui/ToastProvider";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { manualWhatsAppProvider } from "@/lib/whatsapp/provider";
import {
  getCampaign,
  setRecipientMessaged,
  personalizeMessage,
  type Campaign,
  type CampaignRecipient,
} from "@/lib/api/campaigns";

/**
 * One campaign, worked a WhatsApp at a time.
 *
 * <p>Every customer is a row with a WhatsApp button that opens the chat with the message already
 * drafted — the shop presses Send. Opening it marks the customer messaged, and the mark can be set
 * or cleared by hand too, so a run of several hundred can be picked up where it was left: the count
 * at the top says how far through it is.</p>
 */
export default function CampaignView() {
  const campaignId = useRouteId();
  const { can } = usePermissions();
  const { showToast } = useToast();
  const canSend = can(PERMISSIONS.whatsAppSend);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCampaign(await getCampaign(campaignId, getAccessToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load this campaign.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const messagedCount = useMemo(
    () => campaign?.recipients.filter((r) => r.isMessaged).length ?? 0,
    [campaign],
  );

  // Updates one recipient's messaged state locally so the row and the count move at once, without
  // re-fetching the whole list after every click.
  function applyLocal(recipientId: string, messaged: boolean) {
    setCampaign((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            recipients: prev.recipients.map((r) =>
              r.id === recipientId
                ? { ...r, isMessaged: messaged, messagedAtUtc: messaged ? new Date().toISOString() : null }
                : r,
            ),
          },
    );
  }

  async function persistMessaged(recipient: CampaignRecipient, messaged: boolean) {
    applyLocal(recipient.id, messaged);
    try {
      await setRecipientMessaged(campaignId, recipient.id, messaged, getAccessToken());
    } catch {
      // Put it back and say so, rather than letting the screen claim something the server did not take.
      applyLocal(recipient.id, !messaged);
      showToast("Couldn't update that customer. Please try again.", "error");
    }
  }

  async function handleWhatsApp(recipient: CampaignRecipient) {
    if (!campaign) {
      return;
    }
    const digits = recipient.phoneNumber.replace(/\D/g, "");
    if (digits === "") {
      showToast("This customer has no phone number.", "error");
      return;
    }

    setBusyId(recipient.id);
    try {
      await manualWhatsAppProvider.deliver(digits, personalizeMessage(campaign.messageTemplate, recipient.customerName));
      // Opened, so mark them done — unless they already were, which leaves the record alone.
      if (canSend && !recipient.isMessaged) {
        await persistMessaged(recipient, true);
      }
    } catch {
      showToast("Couldn't open WhatsApp. Check the number and try again.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }
  if (error || !campaign) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-danger">
          {error ?? "Campaign not found."}
        </p>
        <Link href="/dashboard/marketing/campaigns" className="text-sm font-medium text-primary hover:text-primary-hover">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const total = campaign.recipients.length;
  const done = total > 0 && messagedCount >= total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/marketing/campaigns" className="text-sm font-medium text-primary hover:text-primary-hover">
          ← Campaigns
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{campaign.name}</h1>
            <p className="mt-0.5 text-sm text-foreground/60">
              {new Date(campaign.createdAtUtc).toLocaleDateString()} · {total}{" "}
              {total === 1 ? "customer" : "customers"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className={`text-lg font-semibold ${done ? "text-success" : ""}`}>
              {messagedCount}/{total}
            </span>
            <span className="text-sm text-foreground/60"> messaged</span>
          </div>
        </div>
      </div>

      {/* The message, as written. Each draft fills in {name} per customer. */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground/50">Message</p>
        <p className="whitespace-pre-wrap text-sm">{campaign.messageTemplate}</p>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {campaign.recipients.map((recipient) => (
          <li key={recipient.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{recipient.customerName}</p>
              <p className="text-xs text-foreground/60">{toDisplayPhoneNumber(recipient.phoneNumber)}</p>
            </div>

            {/* The messaged mark — set automatically when WhatsApp is opened, and adjustable by hand. */}
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={recipient.isMessaged}
                disabled={!canSend}
                onChange={(e) => persistMessaged(recipient, e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)] disabled:opacity-50"
              />
              {recipient.isMessaged ? "Messaged" : "Not yet"}
            </label>

            <button
              type="button"
              onClick={() => handleWhatsApp(recipient)}
              disabled={busyId === recipient.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-success-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.6-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1.7-.1 1.3Z" />
              </svg>
              WhatsApp
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
