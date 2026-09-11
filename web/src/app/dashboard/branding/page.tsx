"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getBranding, saveBranding, EMPTY_BRANDING, type Branding } from "@/lib/api/branding";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export default function BrandingPage() {
  const { showToast } = useToast();
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // A load that lands after the reader has started typing must not overwrite them. See the same
  // guard on Invoice Settings for what that looked like: edits vanished, and Save reported success
  // because writing back the unchanged values is a perfectly good request.
  const isEdited = useRef(false);

  const load = useCallback(async () => {
    const loaded = await getBranding(getAccessToken()).catch(() => EMPTY_BRANDING);

    if (!isEdited.current) {
      setBranding(loaded);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function set<K extends keyof Branding>(field: K, value: Branding[K]) {
    isEdited.current = true;
    setBranding((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const color = branding.primaryColor.trim();
    if (color !== "" && !HEX_COLOR.test(color)) {
      setFormError("Theme colour must be a hex value like #4f46e5.");
      return;
    }

    setIsSaving(true);
    try {
      await saveBranding(branding, getAccessToken());
      showToast("Branding saved. Reload to see it everywhere.");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to save branding.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  const previewColor = HEX_COLOR.test(branding.primaryColor.trim()) ? branding.primaryColor.trim() : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Your shop&apos;s name, logo and colour. These appear in the sidebar and on printed invoices.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <Input id="shopName" label="Shop name" value={branding.shopName} onChange={(e) => set("shopName", e.target.value)} />
        <Input
          id="tagline"
          label="Tagline"
          value={branding.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          placeholder="All Types of Tailoring & Fabric Works"
        />
        <Input
          id="contactNumber"
          label="Contact number"
          value={branding.contactNumber}
          onChange={(e) => set("contactNumber", e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-sm font-medium">
            Address
          </label>
          {/* A textarea, not a single line: an invoice letterhead runs to two or three lines and
              each is printed as its own. */}
          <textarea
            id="address"
            rows={3}
            value={branding.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={"12, Lakshmi Nagar, 1st Street\nCoimbatore - 641 018, Tamil Nadu"}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="logoUrl" className="text-sm font-medium">
            Logo URL
          </label>
          <input
            id="logoUrl"
            value={branding.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
            placeholder="https://…/logo.png"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          <p className="text-xs text-foreground/60">
            A link to your logo image. Uploading a file isn&apos;t supported yet — the settings store holds text, not images.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="primaryColor" className="text-sm font-medium">
            Theme colour
          </label>
          <div className="flex items-center gap-3">
            <input
              id="primaryColor"
              value={branding.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              placeholder="#4f46e5"
              className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <input
              type="color"
              aria-label="Pick theme colour"
              value={previewColor ?? "#4f46e5"}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface"
            />
            {previewColor && (
              <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: previewColor }}>
                Preview
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="whatsAppApp" className="text-sm font-medium">
            WhatsApp app
          </label>
          {/* A phone with both apps installed remembers whichever one was tapped "Always" for, and
              then sends every invoice from it. This is how that is overridden — and it is stated as
              a choice rather than assumed, because a shop that shares from the personal number is
              not doing anything wrong. */}
          <select
            id="whatsAppApp"
            value={branding.whatsAppApp.trim().toLowerCase() === "standard" ? "standard" : "business"}
            onChange={(e) => set("whatsAppApp", e.target.value)}
            className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
            <option value="business">WhatsApp Business</option>
            <option value="standard">WhatsApp (personal)</option>
          </select>
          <p className="text-xs text-foreground/60">
            Which app &ldquo;Share via WhatsApp&rdquo; opens on an Android phone. If the chosen app
            isn&apos;t installed, the other one opens instead. On iPhone and on desktop the phone
            decides and this setting has no effect.
          </p>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save branding"}
          </Button>
        </div>
      </form>
    </div>
  );
}
