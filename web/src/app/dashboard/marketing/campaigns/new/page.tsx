"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/ToastProvider";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { searchCustomers, type Customer } from "@/lib/api/customers";
import { createCampaign } from "@/lib/api/campaigns";

const fieldClassName =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

const CUSTOMER_PAGE_SIZE = 100;

/**
 * Create a campaign: a name, the WhatsApp message, and the customers it is for.
 *
 * <p>The whole customer book is loaded once so Select all means all of them, not just a page — a few
 * hundred is a handful of requests and then a plain searchable checklist, which is quicker to work
 * than paging a picker. The message may carry {name}; each draft on the next screen fills it in.</p>
 */
export default function NewCampaignPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    setError(null);
    try {
      const token = getAccessToken();
      const first = await searchCustomers("", 1, CUSTOMER_PAGE_SIZE, token);
      let all = [...first.items];
      // One request per remaining page. The book has no "fetch it all" endpoint, and a few hundred
      // customers is a few pages, done once when the screen opens.
      for (let page = 2; page <= first.meta.totalPages; page++) {
        const next = await searchCustomers("", page, CUSTOMER_PAGE_SIZE, token);
        all = all.concat(next.items);
      }
      setCustomers(all);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load customers.");
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") {
      return customers;
    }
    const digits = query.replace(/\D/g, "");
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(query) ||
        (digits !== "" && c.phoneNumber.replace(/\D/g, "").includes(digits)),
    );
  }, [customers, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  async function handleCreate() {
    if (name.trim() === "") {
      showToast("Give the campaign a name.", "error");
      return;
    }
    if (message.trim() === "") {
      showToast("Write the WhatsApp message.", "error");
      return;
    }
    if (selected.size === 0) {
      showToast("Choose at least one customer.", "error");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const campaign = await createCampaign(
        { name: name.trim(), messageTemplate: message.trim(), customerIds: [...selected] },
        getAccessToken(),
      );
      showToast("Campaign created.");
      router.push(`/dashboard/marketing/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create the campaign.");
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New campaign</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Choose the customers, write the message, and work through them on the next screen.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left: the message. */}
        <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
          <div className="flex flex-col gap-1">
            <label htmlFor="campaign-name" className="text-sm font-medium">
              Campaign name
            </label>
            <input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Diwali offer"
              className={fieldClassName}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="campaign-message" className="text-sm font-medium">
              WhatsApp message
            </label>
            <textarea
              id="campaign-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              maxLength={2000}
              placeholder={"Hi {name}, our new collection has just arrived at Radha Men's. Visit us this week!"}
              className={fieldClassName}
            />
            <p className="text-xs text-foreground/50">
              Use <span className="font-mono">{"{name}"}</span> and each message is drafted with that
              customer&rsquo;s name.
            </p>
          </div>
        </div>

        {/* Right: the customer checklist. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Customers <span className="text-foreground/60">· {selected.size} selected</span>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number…"
              className={`${fieldClassName} max-w-xs`}
            />
          </div>

          {isLoadingCustomers ? (
            <p className="py-6 text-center text-sm text-foreground/70">Loading customers…</p>
          ) : customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/70">No customers on file yet.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 border-b border-border py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Select all{search.trim() !== "" ? " matching" : ""} ({filtered.length})
              </label>
              <ul className="flex max-h-[26rem] flex-col overflow-y-auto">
                {filtered.map((customer) => (
                  <li key={customer.id}>
                    <label className="flex cursor-pointer items-center gap-3 border-b border-border/50 py-2 text-sm hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={selected.has(customer.id)}
                        onChange={() => toggleOne(customer.id)}
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{customer.fullName}</span>
                      <span className="shrink-0 text-xs text-foreground/60">
                        {toDisplayPhoneNumber(customer.phoneNumber)}
                      </span>
                    </label>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="py-6 text-center text-sm text-foreground/60">No customers match that search.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleCreate} disabled={isSaving}>
          {isSaving ? "Creating…" : `Create campaign${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/dashboard/marketing/campaigns")} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
