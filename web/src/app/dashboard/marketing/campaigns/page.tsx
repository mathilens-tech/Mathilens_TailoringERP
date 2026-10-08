"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import { listCampaigns, type CampaignListItem } from "@/lib/api/campaigns";

/**
 * The campaigns a shop has run or is running. Each is a message and a list of customers worked
 * through by hand — this screen is the way in and the way back to one half-finished.
 */
export default function CampaignsPage() {
  const { can } = usePermissions();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCampaigns(await listCampaigns(getAccessToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Message a group of customers on WhatsApp, one by one, and keep track of who you&rsquo;ve done.
          </p>
        </div>
        {can(PERMISSIONS.whatsAppSend) && (
          <Link href="/dashboard/marketing/campaigns/new">
            <Button type="button">New campaign</Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-foreground/70">No campaigns yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((campaign) => {
            const done = campaign.recipientCount > 0 && campaign.messagedCount >= campaign.recipientCount;
            return (
              <li key={campaign.id}>
                <Link
                  href={`/dashboard/marketing/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{campaign.name}</p>
                    <p className="text-xs text-foreground/60">
                      {new Date(campaign.createdAtUtc).toLocaleDateString()} · {campaign.recipientCount}{" "}
                      {campaign.recipientCount === 1 ? "customer" : "customers"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <span className={done ? "font-medium text-success" : "font-medium"}>
                      {campaign.messagedCount}/{campaign.recipientCount}
                    </span>
                    <span className="text-foreground/60"> messaged</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
