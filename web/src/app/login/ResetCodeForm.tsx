"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { redeemResetCode } from "@/lib/api/auth";
import { fieldClassName, labelClassName } from "./fieldStyles";

/**
 * Redeeming the one-time code an Owner handed over, and choosing a password with it.
 *
 * Reached from a link rather than shown automatically when an email is typed. Revealing that an
 * address has a reset outstanding would tell anyone who guesses a staff email both that the account
 * exists and that it is mid-reset — and a flow that lets you set a password by typing only an email
 * address is an account takeover, not a reset.
 */
export function ResetCodeForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

    setIsSubmitting(true);
    try {
      await redeemResetCode(email.trim(), code.trim(), newPassword);
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    /* The instruction that used to sit here is now the page heading's supporting line, so it reads
       once, above the form, in the same place the sign-in form's does. */
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="resetEmail" className={labelClassName}>
          Email address
        </label>
        <input
          id="resetEmail"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClassName}
        />
      </div>

      <div>
        <label htmlFor="resetCode" className={labelClassName}>
          Reset code
        </label>
        {/* Uppercased on the way in because the codes are generated that way; the server ignores
            case and the separator anyway, so this is only to stop it looking wrong as it is typed. */}
        <input
          id="resetCode"
          required
          placeholder="7K4M-92QP"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={`${fieldClassName} font-mono tracking-widest`}
          aria-describedby="resetCodeHelp"
        />
        <p id="resetCodeHelp" className="mt-1.5 text-xs text-foreground/60">
          Eight characters, like 7K4M-92QP. It stops working after a day.
        </p>
        {fieldErrors.code && <p className="mt-1.5 text-sm text-danger">{fieldErrors.code}</p>}
      </div>

      <div>
        <label htmlFor="resetNewPassword" className={labelClassName}>
          New password
        </label>
        <input
          id="resetNewPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Choose a new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={fieldClassName}
        />
        {fieldErrors.newpassword && <p className="mt-1.5 text-sm text-danger">{fieldErrors.newpassword}</p>}
      </div>

      <div>
        <label htmlFor="resetConfirmPassword" className={labelClassName}>
          Confirm new password
        </label>
        <input
          id="resetConfirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Re-enter the new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={fieldClassName}
        />
        {fieldErrors.confirmpassword && <p className="mt-1.5 text-sm text-danger">{fieldErrors.confirmpassword}</p>}
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mx-auto mt-3 px-12">
        {isSubmitting ? "Setting…" : "Set password"}
      </Button>

      <button type="button" onClick={onCancel} className="text-sm text-foreground/70 hover:text-foreground">
        Back to sign in
      </button>
    </form>
  );
}
