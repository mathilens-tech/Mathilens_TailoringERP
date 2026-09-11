"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { storeTokens, getAccessToken } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/api/users";
import { fieldClassName, labelClassName } from "./fieldStyles";

/**
 * Choosing your own password, straight after signing in with the temporary one an Owner issued.
 *
 * <p>This is not a password reset and needs no code: the user has already proved who they are by
 * signing in, seconds ago. It goes through the ordinary change-your-own-password endpoint, which
 * takes the current password — <c>temporaryPassword</c> is exactly that, carried over from the
 * sign-in form rather than typed a second time.</p>
 *
 * <p>The server clears the must-change flag on success and hands back a fresh token pair, so the
 * session the user is standing in keeps working instead of expiring out from under them.</p>
 */
export function ChoosePasswordForm({
  temporaryPassword,
  onDone,
}: {
  temporaryPassword: string;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmpassword: "This does not match the new password." });
      return;
    }

    // Caught here so the obvious case is answered under the cursor; the server enforces the full
    // policy and reports which rule failed.
    if (newPassword === temporaryPassword) {
      setFieldErrors({ newpassword: "Choose something other than the password you were given." });
      return;
    }

    setIsSubmitting(true);
    try {
      const tokens = await changeOwnPassword(temporaryPassword, newPassword, getAccessToken());
      // The pair that comes back is the one without the must-change flag. Storing it is what stops
      // the next page bouncing straight back here.
      storeTokens(tokens);
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) {
          setFieldErrors(Object.fromEntries(error.details.map((d) => [d.field.toLowerCase(), d.message])));
        }
        setFormError(error.message);
      } else {
        setFormError("Unable to reach the server. Please try again.");
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="chosenPassword" className={labelClassName}>
          New password
        </label>
        <input
          id="chosenPassword"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          placeholder="Choose a password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={fieldClassName}
          aria-describedby="chosenPasswordHelp"
        />
        <p id="chosenPasswordHelp" className="mt-1.5 text-xs text-foreground/60">
          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
        </p>
        {fieldErrors.newpassword && <p className="mt-1.5 text-sm text-danger">{fieldErrors.newpassword}</p>}
      </div>

      <div>
        <label htmlFor="chosenConfirmPassword" className={labelClassName}>
          Confirm new password
        </label>
        <input
          id="chosenConfirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Re-enter the password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={fieldClassName}
        />
        {fieldErrors.confirmpassword && (
          <p className="mt-1.5 text-sm text-danger">{fieldErrors.confirmpassword}</p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      {/* No way past this but through it. There is no Cancel and no Skip: the account is on a
          password the Owner read out loud, and "remind me later" is how it stays that way. */}
      <Button type="submit" disabled={isSubmitting} className="mx-auto mt-3 min-h-12 px-12">
        {isSubmitting ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
