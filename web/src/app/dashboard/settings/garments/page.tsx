"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import { countOrdersUsingGarment } from "@/lib/api/orders";
import { getTailoringRates, saveTailoringRates, type TailoringRates } from "@/lib/api/tailoring-rates";
import { listMeasurementTemplates, setMeasurementTemplate, resetMeasurementTemplate } from "@/lib/api/measurements";
import { invalidateMeasurementTemplates } from "@/lib/use-measurement-templates";
import {
  getGarments,
  addGarment,
  removeGarment,
  renameGarment,
  seedGarments,
  hasStoredGarments,
  garmentNameError,
  normaliseGarmentName,
  GARMENT_NAME_MAX_LENGTH,
  type Garment,
} from "@/lib/api/garments";

/**
 * The garments this shop stitches — its own list, in its own words.
 *
 * Feeds Tailoring Cost, which prices what is on this list, and New Order, which offers what has a
 * price. The list starts as the seven this system ships with; a shop adds Saree, Chudidhar,
 * Lehenga, or whatever it actually makes, and removes what it does not.
 */
export default function GarmentSettingsPage() {
  const { showToast } = useToast();
  const { can, isLoaded } = usePermissions();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [rates, setRates] = useState<TailoringRates>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Open with a garment to rename it, or with null to add one. `isFormOpen` is separate so the
  // dialog can close before the garment it was for is cleared, and not flicker into "Add" on the
  // way out.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Garment | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Garment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * How many orders have been booked against each garment, once it is known.
   *
   * Undefined for a garment still being counted, which is why Delete is refused until the answer
   * arrives — offering it while the count is unknown is offering to remove something that may well
   * be on a customer's bill.
   */
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [isCountingUsage, setIsCountingUsage] = useState(true);

  const canManage = can(PERMISSIONS.settingsView);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [list, priceList] = await Promise.all([
        getGarments(getAccessToken()),
        getTailoringRates(getAccessToken()),
      ]);
      setGarments(list);
      setRates(priceList);

      // Counted after the list is on screen rather than alongside it: the names have to be known
      // before anything can be counted, and the table is readable while this finishes.
      setIsCountingUsage(true);
      const counts = await Promise.all(
        list.map(async (garment) => {
          try {
            return [garment.name, await countOrdersUsingGarment(garment.name, getAccessToken())] as const;
          } catch {
            // Unknown rather than zero. Left out of the map, so Delete stays refused for this one —
            // a failed count must not read as "used by nothing".
            return null;
          }
        }),
      );
      setOrderCounts(Object.fromEntries(counts.filter((entry) => entry !== null)));
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load garments.");
    } finally {
      setIsLoading(false);
      setIsCountingUsage(false);
    }
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setName("");
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(garment: Garment) {
    setEditing(garment);
    setName(garment.name);
    setFormError(null);
    setIsFormOpen(true);
  }

  /**
   * Carries a renamed garment's settings over to its new name.
   *
   * The price and the measurement points are both filed under the garment's name, so a rename that
   * moved only the list entry would leave the garment unpriced — and therefore not offered on New
   * Order at all — with its measurement points stranded under a name nothing reads any more.
   *
   * Called before the rename itself, while the old name is still on the garment list; see the
   * caller.
   */
  async function carrySettingsOver(from: string, to: string) {
    const token = getAccessToken();

    const price = rates[from];
    if (price !== undefined) {
      await saveTailoringRates({ [to]: price }, { [from]: price }, token);
    }

    // Only a template the shop actually edited is worth moving. An untouched one is the built-in
    // starting list, which the new name gets by itself — and a garment the shop invented has none.
    const templates = await listMeasurementTemplates(token);
    const template = templates.find((t) => t.garmentType === from);
    if (template?.isCustomised) {
      await setMeasurementTemplate(to, template.points, token);
      await resetMeasurementTemplate(from, token);
      invalidateMeasurementTemplates();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = garmentNameError(name);
    if (problem) {
      setFormError(problem);
      return;
    }

    const normalised = normaliseGarmentName(name);

    if (editing && normalised === editing.name) {
      setIsFormOpen(false);
      return;
    }

    // Two garments answering to the same word on the New Order dropdown is a way to pick the wrong
    // one, and they would share a tailoring price besides. The row being renamed is not its own
    // clash, so correcting only a garment's capitalisation is still allowed.
    if (garments.some((g) => g.name !== editing?.name && g.name.toLowerCase() === normalised.toLowerCase())) {
      setFormError(`${normalised} is already on the list.`);
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      // A shop that has never opened this screen has no keys stored, so the list it is looking at
      // is the shipped default. Record all of it before changing it, or the rest vanish.
      if (!(await hasStoredGarments(getAccessToken()))) {
        await seedGarments(getAccessToken());
      }

      if (editing) {
        // Settings first, rename second. The template list is one row per garment *on the list*, so
        // the old name has to still be on it to read its points back — renaming first would leave
        // the shop's edited points behind under a name nothing looks up any more.
        await carrySettingsOver(editing.name, normalised);
        await renameGarment(editing.name, normalised, getAccessToken());
        showToast(`${editing.name} is now ${normalised}. Orders already placed keep the old name.`);
      } else {
        await addGarment(normalised, getAccessToken());
        showToast(`${normalised} added. Give it a price under Tailoring Cost.`);
      }

      setIsFormOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to save this garment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      // Counted again rather than trusted from the load: this screen can sit open while the counter
      // takes an order, and the count behind the Delete button would be the one from before it.
      const inUse = await countOrdersUsingGarment(pendingDelete.name, getAccessToken());
      if (inUse > 0) {
        setOrderCounts((counts) => ({ ...counts, [pendingDelete.name]: inUse }));
        setPendingDelete(null);
        showToast(`${pendingDelete.name} is on ${inUse} ${inUse === 1 ? "order" : "orders"} and cannot be removed.`, "error");
        return;
      }

      // Same reason as on add: the others have to be written down before one is removed, or the
      // next read finds no keys and hands back the full shipped list again.
      if (!(await hasStoredGarments(getAccessToken()))) {
        await seedGarments(getAccessToken());
      }
      await removeGarment(pendingDelete.name, getAccessToken());
      showToast(`${pendingDelete.name} removed.`);
      setPendingDelete(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to remove this garment.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  /**
   * Why this garment cannot be removed, or null when it can be.
   *
   * A garment named on an order is part of what a customer was billed for. Taking it off the list
   * would leave that order describing something the shop no longer admits to making, so it is
   * refused outright rather than warned about.
   */
  function deleteRefusal(garmentName: string): string | null {
    const count = orderCounts[garmentName];

    if (count === undefined) {
      return isCountingUsage ? "Checking whether this is on any order…" : "Cannot tell whether this is on any order";
    }
    if (count > 0) {
      return `On ${count} ${count === 1 ? "order" : "orders"}`;
    }
    return null;
  }

  function isDeletable(garmentName: string): boolean {
    return deleteRefusal(garmentName) === null;
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">Garments</h1>
        {canManage && (
          <Button type="button" onClick={openAdd}>
            New
          </Button>
        )}
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : garments.length === 0 ? (
        <p className="text-sm text-foreground/70">No garments on the list. Add one to start taking orders.</p>
      ) : (
        <div className="max-w-2xl overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border bg-surface-hover px-2 py-2 text-left font-medium sm:px-3">Garment</th>
                <th className="w-24 border border-border bg-surface-hover px-2 py-2 text-right font-medium sm:w-28 sm:px-3">
                  Price
                </th>
                {canManage && (
                  <th className="w-28 border border-border bg-surface-hover px-2 py-2 text-right font-medium sm:w-32 sm:px-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {garments.map((garment) => (
                <tr key={garment.name}>
                  {/* table-fixed plus a wrapping name: a long shop name shrinks this column's text
                      rather than pushing the table past a 320px screen. */}
                  <td className="border border-border px-2 py-2 font-medium break-words sm:px-3">{garment.name}</td>
                  {/* Priced on Tailoring Cost, shown here because a garment with no price is not
                      offered on New Order — which is otherwise invisible from this screen. */}
                  <td className="border border-border px-2 py-2 text-right tabular-nums sm:px-3">
                    {rates[garment.name] === undefined ? (
                      <span className="text-xs text-foreground/50">Not priced</span>
                    ) : (
                      `₹ ${rates[garment.name]}`
                    )}
                  </td>
                  {canManage && (
                    <td className="border border-border px-2 py-2 sm:px-3">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(garment)}
                          className="text-foreground/70 hover:text-foreground"
                        >
                          Edit
                        </button>
                        {/* Refused while the garment is on an order, and while that is still being
                            worked out. Greyed with the reason on it rather than hidden — a missing
                            button says nothing about why the garment cannot go. */}
                        <button
                          type="button"
                          onClick={() => setPendingDelete(garment)}
                          disabled={!isDeletable(garment.name)}
                          title={deleteRefusal(garment.name) ?? undefined}
                          className="text-danger hover:text-danger-hover disabled:cursor-not-allowed disabled:text-foreground/30 disabled:hover:text-foreground/30"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isFormOpen}
        title={editing ? "Edit Garment" : "Add Garment"}
        onClose={() => setIsFormOpen(false)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          <Input
            id="garmentName"
            label="Garment name"
            maxLength={GARMENT_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="mt-1 text-xs text-foreground/60">
            {editing
              ? "Its price and measurement points come with it. Orders already placed keep the old name — they record what was stitched at the time."
              : "What the shop calls it. This is the name on New Order, on Tailoring Cost, and on the customer’s invoice."}
          </p>

          {formError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          )}

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
              CANCEL
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "SUBMIT"}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* No description: the title and the garment's name in it say the whole thing, and Delete is
          only offered for a garment nothing is booked against. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Remove ${pendingDelete.name}?` : "Remove garment"}
        confirmLabel="Remove"
        confirmingLabel="Removing…"
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
