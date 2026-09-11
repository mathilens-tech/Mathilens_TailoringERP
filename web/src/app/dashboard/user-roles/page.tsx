"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { listRoleDetails, createRole, renameRole, deleteRole, PERMISSIONS, type AppRole } from "@/lib/api/users";

/**
 * The roles a shop hands out, and the CRUD over them.
 *
 * A role created here starts able to do nothing at all. That is deliberate rather than an
 * omission: this screen decides that a role exists, and User Rights decides what it means, so a
 * new role granting everything by default would hand out access nobody has described yet. The
 * link across sits next to each row for exactly that reason.
 *
 * The four built-in roles can have their rights changed but cannot be renamed or removed — the
 * default permission sets are written against those names, and Owner in particular has to keep
 * existing so somebody can always grant access.
 */
export default function UserRolesPage() {
  const { showToast } = useToast();
  const { can, isLoaded } = usePermissions();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Null when closed. `editing.id` empty means Add — the form is the same either way, and one
  // piece of state keeps the two dialogs from being able to open at once.
  const [editing, setEditing] = useState<AppRole | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<AppRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const canManageRoles = can(PERMISSIONS.usersRoles);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRoles(await listRoleDetails(getAccessToken()));
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load roles.");
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

  function openAdd() {
    setEditing({ id: "", name: "", isBuiltIn: false, userCount: 0 });
    setName("");
    setFormError(null);
  }

  function openEdit(role: AppRole) {
    setEditing(role);
    setName(role.name);
    setFormError(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!editing) {
      return;
    }

    if (!name.trim()) {
      setFormError("Enter a name for this role.");
      return;
    }

    setIsSaving(true);
    try {
      if (editing.id === "") {
        await createRole(name.trim(), getAccessToken());
        showToast(`${name.trim()} added. Give it its rights on User Rights.`);
      } else {
        await renameRole(editing.id, name.trim(), getAccessToken());
        showToast("Role renamed.");
      }
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to save this role.");
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
      await deleteRole(pendingDelete.id, getAccessToken());
      showToast(`${pendingDelete.name} deleted.`);
      setPendingDelete(null);
      await load();
    } catch (error) {
      // The server refuses a role still in use and says how many people hold it — show it as-is.
      showToast(error instanceof ApiError ? error.message : "Unable to delete this role.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">User Role</h1>
        {canManageRoles && (
          <Button type="button" onClick={openAdd}>
            Add Role
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : (
        <div className="table-wrap rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-border last:border-0">
                  <td data-label="Role" className="px-4 py-3 font-medium">
                    {role.name}
                  </td>
                  <td data-label="Type" className="px-4 py-3 text-foreground/70">
                    {role.isBuiltIn ? "Built in" : "Added by the shop"}
                  </td>
                  <td data-label="Users" className="px-4 py-3 tabular-nums">
                    {role.userCount}
                  </td>
                  <td data-label="" className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-4">
                      <Link href="/dashboard/user-rights" className="whitespace-nowrap text-foreground/70 hover:text-foreground">
                        Rights
                      </Link>
                      {/* Shown on every row, greyed where the action is refused, rather than
                          missing from built-in rows — an absent control reads as a screen that
                          forgot them, and says nothing about why they cannot be touched. */}
                      {canManageRoles && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(role)}
                            disabled={role.isBuiltIn}
                            title={role.isBuiltIn ? "Built-in roles cannot be renamed" : undefined}
                            className="text-foreground/70 hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/30 disabled:hover:text-foreground/30"
                          >
                            Edit
                          </button>
                          {/* Refused while anybody holds it. The server refuses either way — this
                              is so the reason is visible before the click rather than after. */}
                          <button
                            type="button"
                            onClick={() => setPendingDelete(role)}
                            disabled={role.isBuiltIn || role.userCount > 0}
                            title={
                              role.isBuiltIn
                                ? "Built-in roles cannot be deleted"
                                : role.userCount > 0
                                  ? `Held by ${role.userCount} ${role.userCount === 1 ? "user" : "users"}`
                                  : undefined
                            }
                            className="text-danger hover:text-danger-hover disabled:cursor-not-allowed disabled:text-foreground/30 disabled:hover:text-foreground/30"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id === "" ? "Add Role" : "Edit Role"}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={handleSave} className="flex flex-col">
          <Input
            id="roleName"
            label="Role name"
            placeholder="e.g. Assistant Manager"
            value={name}
            onChange={(e) => setName(e.target.value)}
            ref={nameRef}
            autoFocus
          />
          <p className="mt-1 text-xs text-foreground/60">
            Letters, numbers, spaces, hyphens and underscores. What it is allowed to do is set on User Rights.
          </p>

          {formError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          )}

          <ModalActions>
            {/* CLEAR empties the field rather than closing the dialog — the X and Escape are what
                close it. The cursor goes back into the box afterwards: emptying a field the eye is
                not on, while focus sits on the button that did it, looks like nothing happened. */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setName("");
                setFormError(null);
                nameRef.current?.focus();
              }}
              disabled={isSaving}
            >
              CLEAR
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "SUBMIT"}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete role"
        description={
          pendingDelete
            ? `Are you sure you want to delete the ${pendingDelete.name} role? Nobody holds it, and its rights will be forgotten.`
            : ""
        }
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
