"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  DEFAULT_ORDER_DUE_DATE_DAYS_KEY,
  MEASUREMENT_TEMPLATE_KEY_PREFIX,
  type Setting,
} from "@/lib/api/settings";
import { TAILORING_RATE_KEY_PREFIX } from "@/lib/api/tailoring-rates";
import { GARMENT_KEY_PREFIX } from "@/lib/api/garments";
import { USER_PHOTO_KEY_PREFIX } from "@/lib/api/user-profile";

/**
 * The raw settings store — the escape hatch for a value that needs changing before it has a
 * purpose-built editor.
 *
 * Owner-only, and not because the API demands it: Settings.Manage would let a Manager in here, and
 * these are unlabelled keys with no validation behind them. The rest of Settings is the safe way to
 * change anything a shop normally changes.
 *
 * <p>Edit-only. Hand-typing a new key produced rows that nothing reads, so there is no Add.</p>
 */
export default function AdvancedSettingsPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Setting | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Setting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await listSettings(page, pageSize, getAccessToken());
      // Keys that have a purpose-built editor are hidden here — editing a measurement template as a
      // line of JSON is a way to break it, not a feature.
      setSettings(
        items.filter(
          (s) =>
            s.key !== DEFAULT_ORDER_DUE_DATE_DAYS_KEY &&
            !s.key.startsWith(MEASUREMENT_TEMPLATE_KEY_PREFIX) &&
            !s.key.startsWith(TAILORING_RATE_KEY_PREFIX) &&
            !s.key.startsWith(GARMENT_KEY_PREFIX) &&
            // A profile picture is four thousand characters of base64 — a row nobody can read and
            // nobody should hand-edit.
            !s.key.startsWith(USER_PHOTO_KEY_PREFIX),
        ),
      );
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load settings.");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!editing) {
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertSetting(editing.key, formValue, getAccessToken());
      showToast("Setting updated.");
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to save this setting.");
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
      await deleteSetting(pendingDelete.key, getAccessToken());
      showToast("Setting deleted.");
      setPendingDelete(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to delete this setting.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Advanced</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Raw stored settings, with no validation behind them. Anything a shop normally changes has
          its own screen under Settings — use those instead where they exist.
        </p>
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <Input id="settingKey" label="Key" value={editing.key} onChange={() => {}} disabled />
          <Textarea id="settingValue" label="Value" rows={3} value={formValue} onChange={(e) => setFormValue(e.target.value)} />
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-foreground/70 hover:text-foreground">
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : settings.length === 0 ? (
        <p className="text-sm text-foreground/70">No settings configured yet.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.id} className="border-b border-border last:border-0">
                  <td data-label="Key" className="px-4 py-3 font-mono">{setting.key}</td>
                  <td data-label="Value" className="max-w-md truncate px-4 py-3">{setting.value}</td>
                  <td data-label="" className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(setting);
                          setFormValue(setting.value);
                          setFormError(null);
                        }}
                        className="text-foreground/70 hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => setPendingDelete(setting)} className="text-danger hover:text-danger-hover">
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

      {meta && (
        <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete setting"
        description={pendingDelete ? `Are you sure you want to delete "${pendingDelete.key}"? This cannot be undone.` : ""}
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
