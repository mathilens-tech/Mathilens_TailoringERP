"use client";

import { Input } from "@/components/ui/Input";
import { toNationalDigits } from "@/lib/contact";

/**
 * The mobile number field, wherever one is entered.
 *
 * <p>Ten digits, digits only, and the first must be 6-9 as every Indian mobile series is. All three
 * are enforced as the field is typed rather than reported afterwards: there is nothing useful a
 * counter can do with a letter in a phone field, and being corrected about it after filling in the
 * rest of a form is worse than never being allowed to type it.</p>
 *
 * <p>Pasting still works — "+91 82200-70363", "918220070363" and "08220070363" all land as
 * 8220070363, so a number copied out of a message or a spreadsheet drops straight in.</p>
 *
 * <p>One component rather than the same handler copied into each form: this rule now lives in four
 * places, and four copies is four chances for one of them to quietly disagree.</p>
 */
export function PhoneNumberInput({
  id,
  label = "Phone number",
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  id: string;
  label?: string;
  value: string;
  /** Receives the cleaned value — already digits, already capped, already a plausible series. */
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /** For a screen that shows a number rather than asks for one. */
  disabled?: boolean;
}) {
  return (
    <Input
      id={id}
      label={label}
      disabled={disabled}
      // type="tel" keeps it a phone number to autofill and screen readers; inputMode="numeric"
      // brings up the digits-only keypad on the tablet at the counter.
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      pattern="[0-9]{10}"
      placeholder="9876543210"
      value={value}
      onChange={(e) => {
        const next = cleanPhoneNumberInput(e.target.value);
        // null means the edit was refused — the field keeps exactly what it had, so the keystroke
        // does nothing rather than clearing a number that was already correct.
        if (next !== null) {
          onChange(next);
        }
      }}
      onBlur={onBlur}
      error={error}
    />
  );
}

/**
 * What a keystroke or a paste is allowed to leave in the field: the cleaned value, or
 * <c>null</c> when the edit should be refused outright.
 *
 * <p>Exported for the one caller that needs the rule without the component. Deliberately not
 * wired to a <c>maxLength</c> attribute: the browser applies that before the change handler runs,
 * which would chop a pasted "+918220070363" to "+91822007" instead of reading it as a number.
 * The cap is applied here, after the paste has been understood.</p>
 */
export function cleanPhoneNumberInput(raw: string): string | null {
  const digits = toNationalDigits(raw).slice(0, 10);

  // Emptying the field is always allowed — that is someone starting over, not a bad number.
  if (digits.length === 0) {
    return "";
  }

  // No Indian mobile number opens 0-5, so the keystroke that would start one is refused rather
  // than accepted and complained about later. Only the first digit is constrained.
  return /[6-9]/.test(digits[0]) ? digits : null;
}
