"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useBranding } from "@/lib/use-branding";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  getCustomerMessageTemplate,
  getOrderMessageTemplate,
  saveCustomerMessageTemplate,
  saveOrderMessageTemplate,
  renderTemplate,
  COMMON_FIELDS,
  ORDER_FIELDS,
  DEFAULT_CUSTOMER_TEMPLATE,
  DEFAULT_ORDER_TEMPLATE,
  type TemplateField,
} from "@/lib/whatsapp/templates";

/**
 * What the WhatsApp icon drafts, on the two screens that offer one without an occasion behind it.
 *
 * Not every WhatsApp message in this app: the invoice, ready-for-collection and delivered messages
 * are sent at a fixed moment and quote figures a customer will hold the shop to, so they stay in
 * code where they cannot be edited into something that omits the balance. These two are the ones
 * with nothing to say until the shop says it.
 */
export default function WhatsAppMessagesSettingsPage() {
  const { showToast } = useToast();
  const branding = useBranding();
  const [customerTemplate, setCustomerTemplate] = useState("");
  const [orderTemplate, setOrderTemplate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    // Neither rejects — an unconfigured shop gets the defaults.
    const [customer, order] = await Promise.all([
      getCustomerMessageTemplate(getAccessToken()),
      getOrderMessageTemplate(getAccessToken()),
    ]);
    setCustomerTemplate(customer);
    setOrderTemplate(order);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await Promise.all([
        saveCustomerMessageTemplate(customerTemplate, getAccessToken()),
        saveOrderMessageTemplate(orderTemplate, getAccessToken()),
      ]);
      showToast("WhatsApp messages saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these messages.");
    } finally {
      setIsSaving(false);
    }
  }

  const shopName = branding.shopName || "Mathilens";

  /** Stand-in values, so the preview reads as a message rather than as a row of braces. */
  const sample: Record<string, string> = {
    "{customerName}": "Asha",
    "{shopName}": shopName,
    "{orderNumber}": "MTL-0007",
    "{orderTotal}": "₹2,400.00",
    "{balanceDue}": "₹900.00",
    "{collectionDate}": "25-Aug-2026",
  };

  return (
    <form onSubmit={handleSave} className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp Messages</h1>
        <p className="mt-1 text-sm text-foreground/70">
          The text that opens when staff press the WhatsApp icon. Edit it here and it applies
          everywhere that icon appears.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : (
        <>
          <TemplateEditor
            id="customerTemplate"
            label="Customer message"
            hint="Used by the WhatsApp icon on the Customers screen, and when messaging several customers at once. This is the one to write an offer or a greeting in."
            value={customerTemplate}
            onChange={setCustomerTemplate}
            fields={COMMON_FIELDS}
            onReset={() => setCustomerTemplate(DEFAULT_CUSTOMER_TEMPLATE)}
            preview={renderTemplate(customerTemplate, sample)}
          />

          <TemplateEditor
            id="orderTemplate"
            label="Order message"
            hint="Used by the WhatsApp icon on an order. The invoice, ready-for-collection and delivered messages are sent automatically at those moments and are not edited here."
            value={orderTemplate}
            onChange={setOrderTemplate}
            fields={ORDER_FIELDS}
            onReset={() => setOrderTemplate(DEFAULT_ORDER_TEMPLATE)}
            preview={renderTemplate(orderTemplate, sample)}
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save messages"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/** One template: the text, the tokens it may use, and what it comes out as. */
function TemplateEditor({
  id,
  label,
  hint,
  value,
  onChange,
  fields,
  onReset,
  preview,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  fields: readonly TemplateField[];
  onReset: () => void;
  preview: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-base font-medium">
          {label}
        </label>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          Reset to default
        </button>
      </div>
      <p className="text-sm text-foreground/70">{hint}</p>

      <textarea
        id={id}
        rows={9}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // autoCapitalize off: this is a template, and capitalising {customerName} as it is typed
        // would break the token rather than tidy the sentence.
        autoCapitalize="none"
        spellCheck={false}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground/60">Insert:</span>
        {fields.map((field) => (
          <button
            key={field.token}
            type="button"
            // Appended rather than inserted at the caret. Inserting properly means owning the
            // textarea's selection, and the gain over typing the token by hand is small — the list
            // is here mostly so nobody has to guess what the tokens are called.
            onClick={() => onChange(`${value}${field.token}`)}
            title={field.label}
            className="rounded-md border border-border px-2 py-1 font-mono text-xs transition-colors hover:border-primary hover:text-primary"
          >
            {field.token}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-foreground/60">Preview</p>
        {/* The exact string that will be handed to WhatsApp, with sample values in place of the
            tokens. The asterisks stay visible on purpose: they are what WhatsApp turns into bold at
            the other end, and a box that rendered them would be hiding part of the message. */}
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-hover px-3 py-2 text-xs">
          {preview}
        </pre>
      </div>
    </section>
  );
}
