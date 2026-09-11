"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SearchPicker } from "@/components/ui/SearchPicker";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { searchCustomers, type Customer } from "@/lib/api/customers";
import { sendWhatsAppMessage, WHATSAPP_MESSAGE_TYPES, type WhatsAppMessageType } from "@/lib/api/whatsapp";
import { toDisplayPhoneNumber } from "@/lib/contact";

export default function NewWhatsAppMessagePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messageType, setMessageType] = useState<WhatsAppMessageType>(WHATSAPP_MESSAGE_TYPES[2]);
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!customer) {
      setFormError("Select a customer.");
      return;
    }
    if (!content.trim()) {
      setFormError("Enter a message.");
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await sendWhatsAppMessage(customer.id, null, messageType, content, getAccessToken());
      showToast(message.status === "Sent" ? "Message sent." : "Message queued — check its status shortly.");
      router.push(`/dashboard/whatsapp/${message.id}`);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Send WhatsApp Message</h1>
        <Link href="/dashboard/whatsapp" className="text-sm text-foreground/70 hover:text-foreground">
          Back to messages
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <SearchPicker
          id="customer"
          label="Customer"
          selectedLabel={customer ? `${customer.fullName} (${toDisplayPhoneNumber(customer.phoneNumber)})` : null}
          onSelect={setCustomer}
          onClear={() => setCustomer(null)}
          search={searchCustomers}
          getId={(c) => c.id}
          getLabel={(c) => `${c.fullName} (${toDisplayPhoneNumber(c.phoneNumber)})`}
          placeholder="Search customers…"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="messageType" className="text-sm font-medium">
            Message type
          </label>
          <select
            id="messageType"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as WhatsAppMessageType)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
            {WHATSAPP_MESSAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <Textarea id="content" label="Message" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </div>
  );
}
