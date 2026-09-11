"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ModalActions } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken, storeTokens } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { changeOwnPassword } from "@/lib/api/users";

/**
 * Changing your own password.
 *
 * Behind no permission — this is the one password action that is nobody else's business, and every
 * role needs it. Knowing the current password is what stands in for an Owner being present.
 *
 * Its own component because it is reached two ways: the dialog on the profile menu, which is how
 * anyone actually gets here, and the /dashboard/settings/change-password route, which still answers
 * so that a bookmark from before the menu existed keeps working.
 */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Checked here rather than server-side: the confirmation exists to catch a typo before it
    // becomes a password nobody knows, and the server has no business seeing it twice.
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmpassword: "This does not match the new password." });
      return;
    }

    setIsSaving(true);
    try {
      // A fresh pair comes back because every other session was just revoked — storing it is what
      // keeps this session signed in rather than dropping to the login page a few minutes later.
      const tokens = await changeOwnPassword(currentPassword, newPassword, getAccessToken());
      storeTokens(tokens);
      showToast("Password changed. You have been signed out everywhere else.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onDone?.();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) {
          setFieldErrors(Object.fromEntries(error.details.map((d) => [d.field.toLowerCase(), d.message])));
        }
        setFormError(error.message);
      } else {
        setFormError("Unable to change your password.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-foreground/70">Changing your password signs you out on every other device.</p>

      <Input
        id="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={fieldErrors.currentpassword}
        autoFocus
      />
      <Input
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={fieldErrors.newpassword}
      />
      <Input
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmpassword}
      />

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      {/* CANCEL only where there is a dialog to close. On the standalone route there is nothing to
          back out of, so the row is just Submit — as it was before this became a dialog. */}
      <ModalActions>
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone} disabled={isSaving}>
            CANCEL
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "SUBMIT"}
        </Button>
      </ModalActions>
    </form>
  );
}
