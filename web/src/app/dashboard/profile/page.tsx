"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser, displayNameOf, type CurrentUser } from "@/lib/api/users";
import {
  getUserPhoto,
  setUserPhoto,
  removeUserPhoto,
  toAvatarDataUrl,
  initialsFor,
} from "@/lib/api/user-profile";

/**
 * The signed-in person's own record: their picture, who they sign in as, and what that lets them do.
 *
 * Read-only apart from the picture. An email address and a role are somebody else's to change — the
 * Users screen is where that happens, and doing it here would let anyone hand themselves a role.
 */
export default function ProfilePage() {
  const { showToast } = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemove, setShowRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await getCurrentUser(getAccessToken());
      setUser(me);
      setPhoto(await getUserPhoto(me.id, getAccessToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load your profile.");
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

  async function handleFile(file: File | undefined) {
    if (!file || !user) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      // Resized here rather than sent as-is: the settings store caps a value at 4000 characters,
      // which a photo off a phone is three hundred times over.
      const dataUrl = await toAvatarDataUrl(file);
      await setUserPhoto(user.id, dataUrl, getAccessToken());
      setPhoto(dataUrl);
      showToast("Photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save that picture.");
    } finally {
      setIsSaving(false);
      // Cleared so choosing the same file again still fires a change event.
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    if (!user) {
      return;
    }

    setIsSaving(true);
    try {
      await removeUserPhoto(user.id, getAccessToken());
      setPhoto(null);
      setShowRemove(false);
      showToast("Photo removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to remove that picture.");
      setShowRemove(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  if (!user) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error ?? "Unable to load your profile."}
      </p>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Profile</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          {photo ? (
            // A plain img, not next/image: the source is a data URI this app just built, so there
            // is nothing for the image optimiser to fetch or resize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border bg-surface-hover text-xl font-semibold text-foreground/60"
            >
              {initialsFor(displayNameOf(user))}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-2">
            <div className="min-w-0">
              {/* Name first, then the address they sign in with. An account from before names were
                  recorded has none, and displayNameOf falls back to the email — so the line below
                  is dropped rather than printing the same thing twice. */}
              <p className="truncate font-medium">{displayNameOf(user) || "No email on this account"}</p>
              {user.fullName?.trim() && <p className="truncate text-sm text-foreground/70">{user.email}</p>}
              <p className="text-sm text-foreground/70">{user.roles.join(", ") || "No role"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                id="photoFile"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={isSaving}>
                {isSaving ? "Saving…" : photo ? "Change photo" : "Upload photo"}
              </Button>
              {photo && (
                <Button type="button" variant="secondary" onClick={() => setShowRemove(true)} disabled={isSaving}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-foreground/60">
          Square works best — the picture is cropped to a circle and stored small.
        </p>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-base font-semibold">What you can do</h2>
        {/* The resolved permission list, not the role name — a role the shop invented says nothing
            on its own, and this is the only place a person can see their own access. */}
        <ul className="flex flex-wrap gap-2">
          {user.permissions.length === 0 ? (
            <li className="text-sm text-foreground/70">No rights have been granted yet.</li>
          ) : (
            user.permissions.map((permission) => (
              <li key={permission} className="rounded-md border border-border px-2 py-1 text-xs text-foreground/70">
                {permission}
              </li>
            ))
          )}
        </ul>
      </div>

      <ConfirmDialog
        open={showRemove}
        title="Remove photo"
        description="Your initials are shown instead. You can upload another at any time."
        confirmLabel="Remove"
        confirmingLabel="Removing…"
        isConfirming={isSaving}
        onConfirm={handleRemove}
        onCancel={() => setShowRemove(false)}
      />
    </div>
  );
}
