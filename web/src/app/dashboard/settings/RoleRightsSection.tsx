"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import {
  getRolePermissions,
  setRolePermissions,
  resetRolePermissions,
  PERMISSIONS,
  type RolePermissionMatrix,
} from "@/lib/api/users";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The screen names the shop uses, where the permission module name is not what appears in the menu. */
const SCREEN_LABELS: Record<string, string> = {
  WhatsApp: "WhatsApp",
  Pricing: "Fabric Details",
  Inventory: "Inventory",
  Activity: "Activity Log",
  Users: "Users",
  Settings: "Settings",
  Measurements: "Measurements",
};

/**
 * What each tick actually permits, screen by screen and action by action.
 *
 * Every action has its own box now, so this is no longer one sentence per column — it is what
 * "Retire" means on Employees as against what "Delete" means on Orders. An Owner handing out
 * access is entitled to know before they tick it, and "Status" on its own does not say whether
 * that includes handing the garment over.
 */
const ACTION_LABELS: Record<string, Record<string, string>> = {
  Customers: {
    View: "See customers and their history",
    Create: "Add a customer",
    Edit: "Change a customer's details",
    Delete: "Delete a customer",
    Import: "Import customers from a file",
  },
  Measurements: {
    View: "See measurements and past versions",
    Create: "Record a new measurement",
    Edit: "Correct a measurement",
  },
  Employees: {
    View: "See staff records and their order history",
    Create: "Add a member of staff",
    Edit: "Change a staff record",
    Retire: "Retire staff and bring them back",
    Import: "Import staff from a file",
  },
  Orders: {
    View: "See orders and where they stand",
    Create: "Take a new order",
    Edit: "Change an order and its items",
    Delete: "Delete an order",
    Assign: "Assign an order to a tailor",
    Status: "Move an order along, including delivering it",
  },
  Invoices: {
    View: "See invoices and what is owed",
    Create: "Raise an invoice",
    Payment: "Take payments",
    Void: "Void an invoice",
  },
  WhatsApp: {
    View: "See messages sent to customers",
    Send: "Send messages",
  },
  Reports: {
    View: "Open every report, including birthdays and anniversaries",
  },
  Pricing: {
    View: "See the cloth price list",
    Create: "Add a price",
    Edit: "Change a price",
    Delete: "Remove a price",
    Import: "Import prices from a file",
  },
  Inventory: {
    View: "See cloth receipts and stock levels",
    Create: "Record cloth arriving",
  },
  Settings: {
    View: "Open settings screens",
    Edit: "Change settings and measurement templates",
  },
  Activity: {
    View: "See who did what, and when",
  },
  Users: {
    View: "See who can sign in and their roles",
    Create: "Add a user",
    Edit: "Change a user's role",
    Password: "Set passwords and issue reset codes",
    Rights: "Change these rights",
    Roles: "Add, rename and delete roles",
  },
};

/**
 * Which screens a role may see, and which individual actions it may take on them.
 *
 * Owner is deliberately not editable — it always holds every permission. It is the only role
 * guaranteed to carry the right to hand out access, so a shop that stripped it would have nobody
 * left able to grant access to anyone, including to undo that change. The server refuses it too;
 * this just makes the reason visible instead of the save failing.
 */
export function RoleRightsSection() {
  const { showToast } = useToast();
  const { can, isLoaded } = usePermissions();
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null);
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing rights is access control, so it takes its own permission rather than Settings.Manage —
  // otherwise a Manager could grant themselves the right to hand out access.
  const canEditRights = can(PERMISSIONS.usersRights);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getRolePermissions(getAccessToken());
      setMatrix(loaded);
      setRole((current) => current || loaded.roles.find((r) => r.isEditable)?.role || loaded.roles[0]?.role || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load role rights.");
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

  useEffect(() => {
    // Switching role discards unsaved ticks rather than carrying them across roles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(matrix?.roles.find((r) => r.role === role)?.permissions ?? []);
  }, [role, matrix]);

  const current = matrix?.roles.find((r) => r.role === role);
  const isEditable = Boolean(current?.isEditable) && canEditRights;
  const isDirty =
    current !== undefined && JSON.stringify([...selected].sort()) !== JSON.stringify([...current.permissions].sort());

  /**
   * Toggling one box can move others, because they are not independent.
   *
   * An action without View is a role that may change things on a screen it cannot open — the menu
   * hides it, every list is unreachable, and the rights table still claims they can edit. So
   * ticking any action ticks View, and clearing View clears every action on that screen with it.
   * View is the base right; everything else is added on top of it.
   */
  function toggle(permission: string) {
    const [screen, action] = permission.split(".");
    const view = `${screen}.View`;

    setSelected((previous) => {
      if (previous.includes(permission)) {
        return action === "View"
          ? previous.filter((p) => !p.startsWith(`${screen}.`))
          : previous.filter((p) => p !== permission);
      }

      const added = [...previous, permission];
      return action === "View" || added.includes(view) ? added : [...added, view];
    });
  }

  /** Every box on one screen at once — a twelve-action row is not something to tick one at a time. */
  function toggleScreen(screen: string, permissions: string[], allOn: boolean) {
    setSelected((previous) =>
      allOn
        ? previous.filter((p) => !p.startsWith(`${screen}.`))
        : [...previous.filter((p) => !p.startsWith(`${screen}.`)), ...permissions],
    );
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const saved = await setRolePermissions(role, selected, getAccessToken());
      setMatrix((previous) =>
        previous ? { ...previous, roles: previous.roles.map((r) => (r.role === role ? saved : r)) } : previous,
      );
      showToast(`${role} rights saved.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these rights.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setError(null);
    setIsSaving(true);
    try {
      await resetRolePermissions(role, getAccessToken());
      await load();
      showToast(`${role} restored to its standard rights.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset these rights.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Role &amp; Screen Rights</h2>
        <p className="text-sm text-foreground/70">
          Which screens each role can open, and which actions it can take there. Takes effect on their next action —
          nobody has to sign out and back in.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : !matrix ? (
        <p role="alert" className="text-sm text-danger">
          {error ?? "Unable to load role rights."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 sm:max-w-xs">
            <label htmlFor="rightsRole" className="text-sm font-medium">
              Role
            </label>
            <select id="rightsRole" value={role} onChange={(e) => setRole(e.target.value)} className={fieldClassName}>
              {matrix.roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role}
                  {!r.isEditable ? " (all rights, fixed)" : r.isCustomised ? " (customised)" : ""}
                </option>
              ))}
            </select>
          </div>

          {current && !current.isEditable && (
            <p className="rounded-md border border-border bg-background/40 p-3 text-sm text-foreground/70">
              Owner always has every right, and that cannot be changed — it is the only role guaranteed to be able to
              grant access, so removing it would leave nobody able to fix it.
            </p>
          )}

          {current?.isEditable && !canEditRights && (
            <p className="rounded-md border border-border bg-background/40 p-3 text-sm text-foreground/70">
              You can see these rights but not change them. Editing access is reserved for an Owner.
            </p>
          )}

          {/*
            One block per screen rather than a row per screen with a column per action: the actions
            differ from screen to screen — Orders has Assign and Status, Invoices has Payment and
            Void — so a shared column header could only have been "Manage" again. Blocks also fit a
            phone, where a twelve-column grid could not.
          */}
          <div className="flex flex-col gap-3">
            {matrix.screens.map((screen) => {
              const permissions = screen.permissions.map((p) => p.permission);
              const allOn = permissions.every((p) => selected.includes(p));
              const anyOn = permissions.some((p) => selected.includes(p));

              return (
                <div key={screen.screen} className="rounded-lg border border-border p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <h3 className="font-medium">{SCREEN_LABELS[screen.screen] ?? screen.screen}</h3>
                    <button
                      type="button"
                      onClick={() => toggleScreen(screen.screen, permissions, allOn)}
                      disabled={!isEditable || isSaving}
                      className="text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:text-foreground/30 disabled:no-underline"
                    >
                      {allOn ? "Clear all" : anyOn ? "Select all" : "Select all"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {screen.permissions.map((entry) => (
                      <label key={entry.permission} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(entry.permission)}
                          disabled={!isEditable || isSaving}
                          onChange={() => toggle(entry.permission)}
                          aria-label={`${entry.action} — ${SCREEN_LABELS[screen.screen] ?? screen.screen}`}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{entry.action}</span>
                          {/* What the tick actually permits, in the shop's words. "Status" alone
                              does not say whether it includes handing the garment over. */}
                          <span className="block text-foreground/60">
                            {ACTION_LABELS[screen.screen]?.[entry.action] ?? entry.action}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          {isEditable && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving || !current?.isCustomised}
                className="text-sm text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Restore standard rights
              </button>
              <Button type="button" onClick={handleSave} disabled={isSaving || !isDirty}>
                {isSaving ? "Saving…" : "Save rights"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
