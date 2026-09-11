"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { searchWhatsAppMessages, WHATSAPP_MESSAGE_STATUSES, type WhatsAppMessage, type WhatsAppMessageStatus } from "@/lib/api/whatsapp";


export default function WhatsAppMessagesPage() {
  const [status, setStatus] = useState<WhatsAppMessageStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchWhatsAppMessages(null, null, status || null, page, pageSize, getAccessToken());
      setMessages(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load messages.");
    } finally {
      setIsLoading(false);
    }
  }, [status, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages();
  }, [loadMessages]);

  function handleStatusChange(value: string) {
    setStatus(value as WhatsAppMessageStatus | "");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">WhatsApp Messages</h1>
        <Link href="/dashboard/whatsapp/new">
          <Button type="button">Send Message</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="statusFilter" className="text-sm font-medium">
          Filter by status
        </label>
        <select
          id="statusFilter"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
        >
          <option value="">All Status</option>
          {WHATSAPP_MESSAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-foreground/70">No messages found.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Content</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className="border-b border-border last:border-0">
                  <td data-label="Type" className="px-4 py-3">{message.messageType}</td>
                  <td data-label="Content" className="max-w-md truncate px-4 py-3">{message.content}</td>
                  <td data-label="Status" className="px-4 py-3">{message.status}</td>
                  <td data-label="" className="px-4 py-3 text-right">
                    <Link href={`/dashboard/whatsapp/${message.id}`} className="text-foreground/70 hover:text-foreground">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />}
    </div>
  );
}
