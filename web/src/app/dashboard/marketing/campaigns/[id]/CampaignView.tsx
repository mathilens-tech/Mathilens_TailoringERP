"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
  updateCampaign,
  setRecipientMessaged,
  setRecipientMessagedKeepalive,
  personalizeMessage,
  type Campaign,
  type CampaignRecipient,
} from "@/lib/api/campaigns";

type RecipientFilter = "all" | "notSent" | "sent";

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
  const [filter, setFilter] = useState<RecipientFilter>("all");

  // Editing the name and message. Seeded from the campaign when opened, saved back on Save.
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function startEditing() {
    if (!campaign) {
      return;
    }
    setEditName(campaign.name);
    setEditMessage(campaign.messageTemplate);
    setIsEditing(true);
  }

  async function saveEdits() {
    if (!campaign) {
      return;
    }
    if (editName.trim() === "" || editMessage.trim() === "") {
      showToast("A campaign needs a name and a message.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateCampaign(
        campaign.id,
        { name: editName.trim(), messageTemplate: editMessage.trim() },
        getAccessToken(),
      );
      setCampaign(updated);
      setIsEditing(false);
      showToast("Campaign updated.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save the changes.", "error");
    } finally {
      setIsSaving(false);
    }
  }

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

    // Mark messaged BEFORE opening WhatsApp, not after. On a phone the next line navigates this very
    // tab to WhatsApp, so any code after it never runs — which is why the status was not sticking.
    // The row is flipped on screen at once, and the update is sent with keepalive so it still
    // reaches the server after the page has gone; the record is re-read on the next visit.
    if (canSend && !recipient.isMessaged) {
      applyLocal(recipient.id, true);
      setRecipientMessagedKeepalive(campaignId, recipient.id, true, getAccessToken());
    }

    // Called straight after, with no await in between, so it stays inside the click's user gesture —
    // a delay here is what a popup blocker catches on desktop.
    try {
      await manualWhatsAppProvider.deliver(digits, personalizeMessage(campaign.messageTemplate, recipient.customerName));
    } catch {
      showToast("Couldn't open WhatsApp. Check the number and try again.", "error");
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
  const notSentCount = total - messagedCount;
  const done = total > 0 && messagedCount >= total;

  const visibleRecipients = campaign.recipients.filter((r) =>
    filter === "sent" ? r.isMessaged : filter === "notSent" ? !r.isMessaged : true,
  );

  const filterTabs: { key: RecipientFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "notSent", label: "Not Sent", count: notSentCount },
    { key: "sent", label: "Sent", count: messagedCount },
  ];

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

      {/* The message, as written. Each draft fills in {name} per customer. Editable in place —
          changing the wording leaves the customer list and who's been messaged untouched. */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Message</p>
          {canSend && !isEditing && (
            <button type="button" onClick={startEditing} className="text-xs font-medium text-primary hover:text-primary-hover">
              Edit
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-name" className="text-xs font-medium text-foreground/70">
                Campaign name
              </label>
              <input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 sm:max-w-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-message" className="text-xs font-medium text-foreground/70">
                Message
              </label>
              <textarea
                id="edit-message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={8}
                maxLength={2000}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
              <p className="text-xs text-foreground/50">
                Use <span className="font-mono">{"{name}"}</span> for the customer&rsquo;s name in each draft.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={saveEdits} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{campaign.messageTemplate}</p>
        )}
      </div>

      {/* Work the list by what's left: Not Sent while sending, Sent to check, All to see everyone. */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground/70 hover:border-primary/40"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {visibleRecipients.length === 0 ? (
          <li className="p-4 text-center text-sm text-foreground/60">
            {filter === "sent" ? "No one messaged yet." : filter === "notSent" ? "Everyone has been messaged." : "No customers on this campaign."}
          </li>
        ) : (
          visibleRecipients.map((recipient) => (
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-success-hover"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.6-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1.7-.1 1.3Z" />
              </svg>
              WhatsApp
            </button>
          </li>
          ))
        )}
      </ul>
    </div>
  );
}
