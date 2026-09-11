"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getSetting, upsertSetting, ORDER_NUMBER_PREFIX_KEY } from "@/lib/api/settings";

/** Matches what the server will accept and what reads sensibly on a receipt. */
const PREFIX_PATTERN = /^[A-Za-z0-9]{2,10}$/;

/** What the server falls back to when nothing has been set — see OrderNumberGenerator. */
const FALLBACK_PREFIX = "ORD";

/**
 * The code every order number starts with.
 *
 * <p>Only the code is editable. The letter and the count beside it are the shop's own running
 * total, handed out by the database one order at a time and never reused — there is no field for
 * them here because there is no safe value a person could type in. Setting it back would collide
 * with numbers already issued, and setting it forward would burn references for no reason.</p>
 */
export default function OrderNumberSettingsPage() {
  const { showToast } = useToast();
  const [prefix, setPrefix] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const setting = await getSetting(ORDER_NUMBER_PREFIX_KEY, getAccessToken());
      setPrefix(setting.value);
    } catch {
      // Not configured yet — leave it blank, same as a fresh install.
      setPrefix("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const trimmed = prefix.trim();
  /* Mirrors OrderNumberFormat.Format on the server — code, run letter, then four digits starting
     at 1111. The letter shown is A because that is what a shop's first order gets; a shop already
     past a full run will see its own letter on the orders themselves. */
  const preview = `${(trimmed === "" ? FALLBACK_PREFIX : trimmed).toUpperCase()}A-1111`;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!PREFIX_PATTERN.test(trimmed)) {
      setError("Use 2 to 10 letters or numbers, with no spaces or punctuation.");
      return;
    }

    setIsSaving(true);
    try {
      await upsertSetting(ORDER_NUMBER_PREFIX_KEY, trimmed.toUpperCase(), getAccessToken());
      showToast("Order number code saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this setting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Order Number</h1>

      <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-foreground/70">
          Every order is given a reference of its own, made of this code, a letter, and a number that
          counts up by one each time. Staff and customers use it to refer to an order instead of
          reading out an id nobody can remember.
        </p>

        <p className="text-sm text-foreground/70">
          The number runs from 1111 to 9999. When it runs out the letter moves on — A to B, and so on
          — and the number starts at 1111 again, so a reference never grows a fifth digit and never
          reads as though the shop opened this morning.
        </p>

        <Input
          id="orderNumberPrefix"
          label="Code"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          disabled={isLoading}
          maxLength={10}
          placeholder="e.g. MTL"
        />

        <div className="rounded-md border border-border bg-background px-4 py-3">
          <div className="text-xs text-foreground/60">Next order will look like</div>
          <div className="mt-1 font-mono text-lg font-semibold">{preview}</div>
        </div>

        {/* Said plainly, because it is the one thing about this screen that surprises people: the
            code applies from here on, and orders already written down keep the code they were
            issued under. Renumbering them would invalidate every receipt already handed over. */}
        <p className="text-xs text-foreground/60">
          Changing the code affects orders taken from now on. Orders that already have a number keep
          it, and the count carries on rather than restarting.
        </p>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
