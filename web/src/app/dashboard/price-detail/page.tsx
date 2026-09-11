"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { ImportExportButtons } from "@/components/ui/ImportExportButtons";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { searchClothPrices, createClothPrice, updateClothPrice, deleteClothPrice, type ClothPrice } from "@/lib/api/clothPrices";


type FormState = { mode: "create" } | { mode: "edit"; clothPrice: ClothPrice } | null;

export default function PriceDetailPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [clothPrices, setClothPrices] = useState<ClothPrice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(null);
  const [formClothCode, setFormClothCode] = useState("");
  const [formClothName, setFormClothName] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClothPrice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchClothPrices("", page, pageSize, getAccessToken());
      setClothPrices(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load price details.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openCreateForm() {
    setFormState({ mode: "create" });
    setFormClothCode("");
    setFormClothName("");
    setFormCostPrice("");
    setFormSellingPrice("");
    setFormError(null);
  }

  function openEditForm(clothPrice: ClothPrice) {
    setFormState({ mode: "edit", clothPrice });
    setFormClothCode(clothPrice.clothCode);
    setFormClothName(clothPrice.clothName);
    setFormCostPrice(String(clothPrice.costPrice));
    setFormSellingPrice(String(clothPrice.sellingPrice));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!formClothCode.trim()) {
      setFormError("Enter a cloth code.");
      return;
    }
    if (!formClothName.trim()) {
      setFormError("Enter a cloth name.");
      return;
    }
    const costPrice = Number(formCostPrice);
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setFormError("Enter a cost price greater than zero.");
      return;
    }
    const sellingPrice = Number(formSellingPrice);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setFormError("Enter a selling price greater than zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input = { clothCode: formClothCode, clothName: formClothName, costPrice, sellingPrice };
      if (formState?.mode === "edit") {
        await updateClothPrice(formState.clothPrice.id, input, getAccessToken());
      } else {
        await createClothPrice(input, getAccessToken());
      }
      showToast(formState?.mode === "create" ? "Price added." : "Price updated.");
      setFormState(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to save this price.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteClothPrice(pendingDelete.id, getAccessToken());
      showToast("Price deleted.");
      setPendingDelete(null);
      await load();
    } catch (error) {
      // Closed on failure too, not just on success. The refusal that actually happens here is a
      // permanent one — the cloth is on an order and always will be — so leaving the dialog up
      // invites pressing Delete again against an answer that will not change.
      setPendingDelete(null);
      showToast(error instanceof ApiError ? error.message : "Unable to delete this price.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Fabric Details</h1>
        <div className="flex items-start gap-2">
          <ImportExportButtons resource="cloth-prices" label="prices" onImported={load} />
          {/* "New", as on Customers — the heading above already says what is being added. The
              aria-label keeps it unambiguous for a screen reader, which reads the button on its
              own without the heading beside it. */}
          <Button type="button" aria-label="New price" onClick={openCreateForm}>
            New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : clothPrices.length === 0 ? (
        <p className="text-sm text-foreground/70">No prices configured yet.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Cloth code</th>
                <th className="px-4 py-3 font-medium">Cloth name</th>
                <th className="px-4 py-3 font-medium">Cost price</th>
                <th className="px-4 py-3 font-medium">Selling price</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clothPrices.map((clothPrice) => (
                <tr key={clothPrice.id} className="border-b border-border last:border-0">
                  <td data-label="Cloth code" className="px-4 py-3 font-mono">{clothPrice.clothCode}</td>
                  <td data-label="Cloth name" className="px-4 py-3">{clothPrice.clothName}</td>
                  <td data-label="Cost price" className="px-4 py-3">{clothPrice.costPrice.toFixed(2)}</td>
                  <td data-label="Selling price" className="px-4 py-3">{clothPrice.sellingPrice.toFixed(2)}</td>
                  <td data-label="" className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => openEditForm(clothPrice)} className="text-foreground/70 hover:text-foreground">
                        Edit
                      </button>
                      <button type="button" onClick={() => setPendingDelete(clothPrice)} className="text-danger hover:text-danger-hover">
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

      {/* Add and edit are one dialog, as they are on Customers — the fields are identical and only
          the title and the submit word differ. It opens over the list rather than pushing it down
          the page, so the row being edited stays where it was and the table does not jump. */}
      <Modal
        open={formState !== null}
        title={formState?.mode === "edit" ? "Edit Price" : "New Price"}
        onClose={() => setFormState(null)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="clothCode" label="Cloth code" value={formClothCode} onChange={(e) => setFormClothCode(e.target.value)} />
            <Input id="clothName" label="Cloth name" value={formClothName} onChange={(e) => setFormClothName(e.target.value)} />
            <Input id="costPrice" label="Cost price" type="number" min="0" step="0.01" value={formCostPrice} onChange={(e) => setFormCostPrice(e.target.value)} />
            <Input id="sellingPrice" label="Selling price" type="number" min="0" step="0.01" value={formSellingPrice} onChange={(e) => setFormSellingPrice(e.target.value)} />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setFormState(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : formState?.mode === "edit" ? "Save changes" : "Add price"}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete price"
        description={pendingDelete ? `Are you sure you want to delete the price for "${pendingDelete.clothCode}"? This cannot be undone.` : ""}
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
