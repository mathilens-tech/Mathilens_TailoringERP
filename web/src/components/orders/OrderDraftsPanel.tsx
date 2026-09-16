"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { listOrderDrafts, deleteOrderDraft, type OrderDraftSummary } from "@/lib/api/order-drafts";
import { orderKindMeta } from "@/lib/orders/order-kind";

/**
 * Orders that were started and never finished, with the way back into each.
 *
 * <p>On the Orders list rather than a screen of its own: an unfinished order is a job still to do,
 * and the place somebody looks for jobs still to do is the order list. A separate page would be one
 * more thing to remember to check, which is the failure mode the whole feature exists to prevent.</p>
 *
 * <p>Renders nothing at all when there are no drafts. A permanently visible panel reading "no
 * drafts" would be a standing reminder of an absence.</p>
 */
export function OrderDraftsPanel() {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<OrderDraftSummary[]>([]);
  const [pendingDiscard, setPendingDiscard] = useState<OrderDraftSummary | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const load = useCallback(async () => {
    // Silent on failure. Drafts are a convenience on somebody else's screen; an error banner about
    // them above the order list would be alarming out of all proportion to what is unavailable.
    const items = await listOrderDrafts(getAccessToken()).catch(() => []);
    setDrafts(items);
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-mount pattern is intentionally not restructured
    // around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleDiscard() {
    if (!pendingDiscard) {
      return;
    }
    setIsDiscarding(true);
    try {
      await deleteOrderDraft(pendingDiscard.id, getAccessToken());
      setDrafts((previous) => previous.filter((d) => d.id !== pendingDiscard.id));
      showToast("Draft discarded.");
    } catch {
      showToast("Unable to discard this draft.", "error");
    } finally {
      setIsDiscarding(false);
      setPendingDiscard(null);
    }
  }

  if (drafts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-1 text-base font-semibold">Unfinished orders</h2>
      {/* Said up front, because the alternative is finding out by having one vanish. */}
      <p className="mb-3 text-xs text-foreground/60">
        Saved automatically as you type. Opening one picks up where you left off. Drafts are
        discarded a day after they were last saved.
      </p>

      <ul className="flex flex-col gap-2">
        {drafts.map((draft) => {
          const meta = orderKindMeta(draft.kind);
          // LastModifiedAtUtc is null until a draft has been saved a second time, so the created
          // time stands in — a row reading "—" would suggest something was wrong with it.
          const touched = new Date(draft.lastModifiedAtUtc ?? draft.createdAtUtc);

          return (
            <li
              key={draft.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2"
            >
              <Link
                href={`/dashboard/orders/new/${meta.slug}?draft=${draft.id}`}
                className="min-w-0 flex-1 text-sm font-medium text-primary hover:text-primary-hover"
              >
                {draft.summary || meta.label}
              </Link>
              <span className="text-xs text-foreground/60">
                {touched.toLocaleDateString()} {touched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={() => setPendingDiscard(draft)}
                className="text-sm text-danger hover:text-danger-hover"
              >
                Discard
              </button>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDiscard !== null}
        title="Discard this draft?"
        description={`"${pendingDiscard?.summary ?? ""}" will be removed. Any measurements already saved against the customer are kept.`}
        confirmLabel="Discard"
        confirmingLabel="Discarding…"
        isConfirming={isDiscarding}
        onConfirm={handleDiscard}
        onCancel={() => setPendingDiscard(null)}
      />
    </div>
  );
}
