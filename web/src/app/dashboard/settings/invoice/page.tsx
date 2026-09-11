"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";
import { buildInvoicePreview } from "@/components/orders/invoice-preview-sample";
import {
  getInvoiceSettings,
  saveInvoiceSettings,
  DEFAULT_INVOICE_SETTINGS,
  type InvoiceSettings,
} from "@/lib/api/invoice-settings";

const PREFIX_PATTERN = /^[A-Za-z0-9]{2,10}$/;

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/**
 * Everything the shop decides about its invoices, as opposed to what the order decides.
 *
 * <p>Company name, address and phone are the same three settings the Branding screen edits — there
 * is one stored value each, so changing them here changes them there. They are repeated on this
 * screen because they are what prints at the top of an invoice, and looking for them under
 * Branding is not obvious when the invoice is what you are working on.</p>
 */
export default function InvoiceSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRateInput, setTaxRateInput] = useState("0");
  // Set after mount, never during render: a date in the server's HTML that the client works out
  // again is the classic hydration mismatch, and the preview is full of dates.
  const [nowIso, setNowIso] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowIso(new Date().toISOString());
  }, []);

  /**
   * True once the form holds something the reader put there.
   *
   * <p>A second load must never overwrite it. The effect below runs twice in development, and the
   * fields unlock the moment the first read returns — so anything typed in between was being wiped
   * by the second, and Save then wrote back the values as they had been. The save succeeded, which
   * is why it reported success: the request was fine, the payload was stale.</p>
   */
  const isEdited = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const loaded = await getInvoiceSettings(getAccessToken()).catch(() => DEFAULT_INVOICE_SETTINGS);

    if (!isEdited.current) {
      setSettings(loaded);
      setTaxRateInput(String(loaded.taxRatePercent));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function set<K extends keyof InvoiceSettings>(field: K, value: InvoiceSettings[K]) {
    isEdited.current = true;
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function setTaxRate(value: string) {
    isEdited.current = true;
    setTaxRateInput(value);
  }

  // Held as text so a half-typed "0." isn't rewritten under the cursor; validated on save.
  const rate = Number(taxRateInput);
  const isRateValid = Number.isFinite(rate) && rate >= 0 && rate <= 100;

  // What the form currently says, saved or not — the preview follows the fields as they are typed.
  const previewSettings: InvoiceSettings = { ...settings, taxRatePercent: isRateValid ? rate : 0 };
  const preview = nowIso ? buildInvoicePreview(nowIso, previewSettings.taxRatePercent, previewSettings.numberPrefix) : null;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (settings.companyName.trim() === "") {
      setError("Enter the company name — it prints at the top of every invoice.");
      return;
    }

    if (!PREFIX_PATTERN.test(settings.numberPrefix.trim())) {
      setError("The invoice code should be 2 to 10 letters or numbers, with no spaces or punctuation.");
      return;
    }

    if (!isRateValid) {
      setError("Enter a tax rate between 0 and 100.");
      return;
    }

    setIsSaving(true);
    try {
      await saveInvoiceSettings({ ...settings, taxRatePercent: rate }, getAccessToken());
      showToast("Invoice settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoice Settings</h1>
        <p className="mt-1 text-sm text-foreground/70">
          What every invoice this shop raises should carry. The amounts come from the order — these
          are the parts the order can&apos;t tell us.
        </p>
      </div>

      {/* Settings on the left, the invoice they produce on the right — near enough to see a field
          land on the document, which is the whole reason the preview is here rather than a note
          saying what each setting does. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <div>
            <h2 className="font-semibold">Letterhead</h2>
            <p className="mt-1 text-xs text-foreground/60">
              Printed at the top of the invoice. These are the same three values on the{" "}
              <Link href="/dashboard/branding" className="text-primary hover:underline">
                Branding
              </Link>{" "}
              screen — change them in either place. The logo lives there.
            </p>
          </div>

          <Input
            id="companyName"
            label="Company name"
            value={settings.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            disabled={isLoading}
            placeholder="e.g. Radha Fabric"
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="address" className="text-sm font-medium">
              Address
            </label>
            {/* A textarea, not a single line: a letterhead runs to two or three lines and each is
                printed as its own. */}
            <textarea
              id="address"
              rows={3}
              value={settings.address}
              onChange={(e) => set("address", e.target.value)}
              disabled={isLoading}
              placeholder={"12, Lakshmi Nagar, 1st Street\nCoimbatore - 641 018, Tamil Nadu"}
              className={fieldClassName}
            />
          </div>

          <Input
            id="phoneNumber"
            label="Phone number"
            value={settings.phoneNumber}
            onChange={(e) => set("phoneNumber", e.target.value)}
            disabled={isLoading}
            placeholder="e.g. 97890 12345"
          />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold">Invoice format</h2>

          <Input
            id="numberPrefix"
            label="Code"
            value={settings.numberPrefix}
            onChange={(e) => set("numberPrefix", e.target.value)}
            disabled={isLoading}
            maxLength={10}
            placeholder="e.g. INV"
          />

          {/* The year is no longer optional. The count restarts each January, so without the year
              next year's 0001 would be this year's 0001 a second time. */}
          <p className="text-xs text-foreground/60">
            Invoices are numbered <span className="font-medium">{settings.numberPrefix.trim().toUpperCase() || "INV"}-{new Date().getFullYear()}-0001</span>,
            counting up by one as they are raised. The count starts again at 0001 each January.
          </p>

          <p className="text-xs text-foreground/60">
            Changing the code affects invoices raised from now on. Ones already issued keep the
            reference they were given, and the count carries on rather than restarting.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold">Tax</h2>

          <Input
            id="taxRate"
            label="Tax rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRateInput}
            onChange={(e) => setTaxRate(e.target.value)}
            disabled={isLoading}
          />

          <p className="text-xs text-foreground/60">
            Leave the rate at 0 if this shop doesn&apos;t charge tax — the invoice then prints no tax
            line at all rather than a row of zeroes.
          </p>
        </section>

        {/* The one thing about this screen that surprises people, so it is said outright. */}
        <p className="text-xs text-foreground/60">
          Changes apply to invoices raised from now on. Invoices already issued keep the tax they
          were charged, so the shop&apos;s copy still matches the customer&apos;s.
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

      {/* Follows as you scroll the form, so a field near the bottom can still be watched landing on
          the document. Sticky only where there are two columns to be side by side. */}
      <aside className="flex flex-col gap-2 xl:sticky xl:top-6">
        <div>
          <h2 className="font-semibold">Preview</h2>
          <p className="text-xs text-foreground/60">
            A made-up order, shown with the settings as they stand — including changes not saved yet.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          {preview ? (
            <InvoiceDocument
              invoice={preview.invoice}
              order={preview.order}
              customer={preview.customer}
              settings={previewSettings}
            />
          ) : (
            <p className="text-sm text-foreground/70">Loading…</p>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
