"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportExportButtons } from "@/components/ui/ImportExportButtons";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "./CustomerForm";
import { CustomerMessageQueue } from "@/components/whatsapp/CustomerMessageQueue";
import { useToast } from "@/components/ui/ToastProvider";
import { useBranding } from "@/lib/use-branding";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { createManualWhatsAppProvider, toWhatsAppApp, WhatsAppOpenError } from "@/lib/whatsapp/provider";
import { toWhatsAppNumber } from "@/lib/whatsapp/whatsapp-service";
import { getCustomerMessageTemplate, renderTemplate } from "@/lib/whatsapp/templates";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import {
  createCustomer,
  searchCustomers,
  deleteCustomer,
  updateCustomer,
  RELIGIONS,
  type Customer,
  type Religion,
} from "@/lib/api/customers";
import { toDisplayPhoneNumber } from "@/lib/contact";

const filterClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

export default function CustomersPage() {
  const { showToast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [religion, setReligion] = useState<Religion | "">("");
  // Religion is a niche, occasion-wear filter, not something staff narrow by every day, so it
  // sits behind a disclosure rather than taking permanent space next to the search box.
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  // The customer being edited, held whole rather than by id: the list already carries every field
  // the form asks for, so opening the dialog costs no request and shows no loading state.
  const [editing, setEditing] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const branding = useBranding();

  /**
   * Who is ticked, by id rather than by row.
   *
   * Ids, so a selection survives the list reloading underneath it — searching, paging and the
   * religion filter all replace `customers` wholesale, and a selection held as indices or as whole
   * records would either point at the wrong people or quietly empty itself. It also means a
   * selection can span pages, which is the point of select-all on a paged list.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Held whole, because the queue messages people who may no longer be on the visible page. */
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, Customer>>(new Map());
  const [queueOpen, setQueueOpen] = useState(false);
  /**
   * The shop's draft, fetched when the page loads rather than when the icon is pressed.
   *
   * Opening WhatsApp has to happen inside the click that asked for it or the pop-up blocker stops
   * it, and awaiting a settings request first is exactly what breaks that. So the template is here
   * before anybody presses anything.
   */
  const [customerTemplate, setCustomerTemplate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCustomerMessageTemplate(getAccessToken()).then((value) => {
      if (!cancelled) {
        setCustomerTemplate(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSelected(customer: Customer) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(customer.id)) {
        next.delete(customer.id);
      } else {
        next.add(customer.id);
      }
      return next;
    });
    setSelectedCustomers((previous) => {
      const next = new Map(previous);
      if (next.has(customer.id)) {
        next.delete(customer.id);
      } else {
        next.set(customer.id, customer);
      }
      return next;
    });
  }

  /**
   * Select-all covers this page, not the whole result set.
   *
   * A header tick that silently selected ten thousand customers behind a search term is how a
   * promotional message goes to the wrong list. What is on screen is what the box refers to, and
   * the count beside the send button says how many are actually held.
   */
  const allOnPageSelected = customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  function toggleSelectAllOnPage() {
    const shouldSelect = !allOnPageSelected;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const customer of customers) {
        if (shouldSelect) {
          next.add(customer.id);
        } else {
          next.delete(customer.id);
        }
      }
      return next;
    });
    setSelectedCustomers((previous) => {
      const next = new Map(previous);
      for (const customer of customers) {
        if (shouldSelect) {
          next.set(customer.id, customer);
        } else {
          next.delete(customer.id);
        }
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedCustomers(new Map());
  }

  /** One customer, straight from their row — no queue, no dialog, just their chat. */
  async function messageOne(customer: Customer) {
    const number = toWhatsAppNumber(customer.phoneNumber);
    if (number === null) {
      showToast("This customer's number is not a valid WhatsApp number.", "error");
      return;
    }
    if (customerTemplate === null) {
      showToast("The message template is still loading. Try again in a moment.", "error");
      return;
    }

    const message = renderTemplate(customerTemplate, {
      "{customerName}": customer.fullName,
      "{shopName}": branding.shopName || "Mathilens",
    });

    try {
      // Parsed rather than cast: the setting is editable by hand through Settings › Advanced, so
      // it is not guaranteed to hold either of the two app names.
      await createManualWhatsAppProvider(toWhatsAppApp(branding.whatsAppApp)).deliver(number, message);
    } catch (error) {
      showToast(
        error instanceof WhatsAppOpenError ? error.message : "Unable to open WhatsApp.",
        "error",
      );
    }
  }

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchCustomers(debouncedSearch, page, pageSize, getAccessToken(), religion || null);
      setCustomers(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load customers.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, religion, page, pageSize]);

  useEffect(() => {
    // The standard fetch-on-dependency-change pattern: loadCustomers' setState calls all
    // happen after an `await`, in a genuine async continuation, not synchronously within this
    // effect body — unlike the auth-guard/hydration cases elsewhere in this app, there's no
    // SSR snapshot for the compiler to race against here (this whole page is client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
  }, [loadCustomers]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCustomer(pendingDelete.id, getAccessToken());
      showToast("Customer deleted.");
      setPendingDelete(null);
      await loadCustomers();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to delete this customer.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex flex-wrap items-start gap-2">
          <ImportExportButtons resource="customers" label="customers" onImported={loadCustomers} previewBeforeImport />
          {/* Opens in place rather than navigating. The list stays on screen behind it, so adding
              a customer no longer costs the page position, the search term and the filters.
              /dashboard/customers/new still works — bookmarks and older links keep resolving. */}
          <Button type="button" aria-label="New customer" onClick={() => setIsAdding(true)}>
            New
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <Input
              id="search"
              label="Search by name or phone"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search customers…"
              // A query is not a name being recorded — capitalising it as it is typed would
              // change what is sent to the server, not just how it looks.
              autoCapitalize="none"
              className="w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancedOpen((open) => !open)}
            aria-expanded={isAdvancedOpen}
            aria-controls="advancedFilters"
            className="shrink-0 rounded-md border border-border px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {/* The count keeps a collapsed-but-active filter from silently narrowing the list. */}
            Advanced filter{religion ? " (1)" : ""}
          </button>
        </div>

        {isAdvancedOpen && (
          <div id="advancedFilters" className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="religionFilter" className="text-sm font-medium">
                Religion
              </label>
              <select
                id="religionFilter"
                value={religion}
                onChange={(e) => {
                  setReligion(e.target.value as Religion | "");
                  // A narrower list can be shorter than the page you're on.
                  setPage(1);
                }}
                className={filterClassName}
              >
                <option value="">All religions</option>
                {RELIGIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {religion && (
              <button
                type="button"
                onClick={() => {
                  setReligion("");
                  setPage(1);
                }}
                className="py-2 text-sm text-foreground/70 hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Only once something is ticked. A permanent bar would take a row of space on a phone to say
          nothing, and the selection is the only thing it can act on. Sticky, because a selection
          spanning pages is made by scrolling and the send button must not scroll away with it. */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-surface px-4 py-3 shadow-sm">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-foreground/70 hover:text-foreground"
          >
            Clear
          </button>
          <div className="ml-auto">
            <Button type="button" onClick={() => setQueueOpen(true)} disabled={customerTemplate === null}>
              Send WhatsApp message
            </Button>
          </div>
        </div>
      )}

      {queueOpen && customerTemplate !== null && (
        <CustomerMessageQueue
          customers={[...selectedCustomers.values()]}
          template={customerTemplate}
          shopName={branding.shopName || "Mathilens"}
          whatsAppApp={toWhatsAppApp(branding.whatsAppApp)}
          onClose={() => setQueueOpen(false)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-foreground/70">No customers found.</p>
      ) : (
        <div className="table-wrap rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all customers on this page"
                    className="h-4 w-4 accent-primary"
                  />
                </th>
                {/* Phone leads: it is what a customer is looked up by at the counter, and it is
                    the way in to their record. */}
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td data-label="" className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(customer.id)}
                      onChange={() => toggleSelected(customer)}
                      aria-label={`Select ${customer.fullName}`}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  {/* The phone is the way into the record — their details, their previous orders
                      and their measurements are all on the other side of it. It replaces the
                      Measurements link that used to sit in the actions, which only ever went to
                      the same page. */}
                  <td data-label="Phone" className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                    >
                      {toDisplayPhoneNumber(customer.phoneNumber)}
                    </Link>
                  </td>
                  <td data-label="Name" className="px-4 py-3">
                    {customer.fullName}
                  </td>
                  <td data-label="Email" className="px-4 py-3">
                    {customer.email ?? "—"}
                  </td>
                  <td data-label="" className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      {/* A real tel: link rather than a button that copies the number. On the phone
                          at the counter it opens the dialer with the number already in it, which is
                          the whole point when an order is ready and the shop is ringing round; on a
                          desktop it hands off to whatever handles calls there, or does nothing, and
                          the number is still readable in the first column either way. */}
                      <a
                        href={`tel:${customer.phoneNumber}`}
                        aria-label={`Call ${customer.fullName}`}
                        title={`Call ${toDisplayPhoneNumber(customer.phoneNumber)}`}
                        className="text-success hover:text-success/80"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                        </svg>
                      </a>
                      {/* Beside the dialer, because they are the same decision — reach this
                          customer now — taken through whichever of the two they answer. A button
                          rather than a link: the URL depends on the device and on the shop's
                          chosen WhatsApp app, and is built at the moment of the press. */}
                      <button
                        type="button"
                        onClick={() => messageOne(customer)}
                        aria-label={`Message ${customer.fullName} on WhatsApp`}
                        title={`Message ${customer.fullName} on WhatsApp`}
                        className="text-success hover:text-success/80"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
                        </svg>
                      </button>
                      {/* In place, like New. Editing from the list no longer means losing the page
                          and the search term. */}
                      <button
                        type="button"
                        onClick={() => setEditing(customer)}
                        className="text-foreground/70 hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(customer)}
                        className="text-danger hover:text-danger-hover"
                      >
                        Delete
                      </button>
                    </div>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete customer"
        description={pendingDelete ? `Are you sure you want to delete ${pendingDelete.fullName}?` : ""}
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Modal open={isAdding} title="New Customer" onClose={() => setIsAdding(false)}>
        <CustomerForm
          onCancel={() => setIsAdding(false)}
          onSubmit={async (input) => {
            await createCustomer(input, getAccessToken());
            showToast("Customer created.");
            setIsAdding(false);
            // Reload rather than close-and-hope: the new customer may or may not fall on the page
            // currently shown, and a list that silently disagrees with what was just saved is worse
            // than a moment of loading.
            await loadCustomers();
          }}
        />
      </Modal>

      {/* Keyed on the customer so the form remounts per row — without it, opening a second customer
          would show the first one's values, since the fields are seeded from props on mount only. */}
      <Modal open={editing !== null} title="Edit Customer" onClose={() => setEditing(null)}>
        {editing && (
          <CustomerForm
            key={editing.id}
            customerId={editing.id}
            initialValues={{
              fullName: editing.fullName,
              phoneNumber: editing.phoneNumber,
              email: editing.email,
              address: editing.address,
              notes: editing.notes,
              gender: editing.gender,
              religion: editing.religion,
              dateOfBirth: editing.dateOfBirth,
              weddingDate: editing.weddingDate,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await updateCustomer(editing.id, input, getAccessToken());
              showToast("Customer updated.");
              setEditing(null);
              await loadCustomers();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
