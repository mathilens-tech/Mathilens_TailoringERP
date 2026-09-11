"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ModalActions } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { DatePartsInput } from "@/components/ui/DatePartsInput";
import { PhoneNumberInput } from "@/components/ui/PhoneNumberInput";
import { DuplicateWarningModal } from "@/components/customers/DuplicateWarningModal";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { emailError, normalizePhoneNumber, phoneNumberError, toNationalDigits } from "@/lib/contact";
import {
  findCustomerDuplicates,
  GENDERS,
  type CustomerDuplicate,
  type CustomerInput,
  type Gender,
  type Religion,
} from "@/lib/api/customers";

type CustomerFormProps = {
  initialValues?: CustomerInput;
  /** Omitted when read-only — a view has nothing to save. */
  onSubmit?: (input: CustomerInput) => Promise<void>;
  /** Closes the dialog, or navigates back on the standalone pages. Omitted when read-only. */
  onCancel?: () => void;
  /** The customer being edited, so the duplicate check doesn't report them against themselves. */
  customerId?: string;
  /**
   * Shows the details without offering to change them: every field disabled, no Cancel or Submit,
   * and no duplicate check — there is no edit in progress for one to warn about.
   *
   * The customer page is a view. Editing happens in the dialog on the list, which is where the
   * person being changed is named. Leaving live fields on a page with no way to save them was the
   * worse of the two, since it invites an edit that silently goes nowhere.
   */
  readOnly?: boolean;
};

/** Long enough that tabbing straight through phone and email asks once, not twice. */
const DUPLICATE_CHECK_DELAY_MS = 350;

const emptyValues: CustomerInput = {
  fullName: "",
  phoneNumber: "",
  email: null,
  address: null,
  notes: null,
  gender: null,
  religion: null,
  dateOfBirth: null,
  weddingDate: null,
};

/**
 * The three the counter is actually asked about, shown as their initial. The rest of RELIGIONS
 * stays available to a record that already holds one — a Sikh customer entered before this list
 * was shortened keeps their S rather than being quietly re-answered on the next save.
 */
const RELIGION_CHOICES: readonly Religion[] = ["Hindu", "Muslim", "Christian"];

/** A segmented control's option: the radio is real, the box around it is what you see. */
const chipClassName =
  "block cursor-pointer rounded-md border border-border px-2 py-2 text-center text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-60";

/**
 * Shared by the create and edit customer dialogs — preserves user input on validation failure
 * (00_MASTER_SPEC.md § 9.5 Forms).
 *
 * Two columns at every width, not just from the small breakpoint up. Nine fields stacked one per
 * row is three phone screens deep, and a form you have to scroll to read is one where the last
 * fields get skipped; paired short fields and a compact date control put the whole customer on a
 * single screen. Cancel and Submit sit above the fields for the same reason — at the bottom of a
 * form that long they are the part that ends up off screen.
 */
export function CustomerForm({
  initialValues = emptyValues,
  onSubmit,
  onCancel,
  customerId,
  readOnly = false,
}: CustomerFormProps) {
  const [fullName, setFullName] = useState(initialValues.fullName);
  // Shown as the ten digits the customer would recite. Saved records hold "+918220070363"; the
  // country code is the database's business, not something to make staff read past on every edit.
  const [phoneNumber, setPhoneNumber] = useState(toNationalDigits(initialValues.phoneNumber));
  const [email, setEmail] = useState(initialValues.email ?? "");
  const [address, setAddress] = useState(initialValues.address ?? "");
  const [notes, setNotes] = useState(initialValues.notes ?? "");
  // Male and Hindu unless the record says otherwise: it is what most of the counter's customers
  // answer, and these are the two questions staff otherwise leave blank. A view is exempt — it
  // must show what was recorded, blank included, rather than inventing an answer for someone.
  const [gender, setGender] = useState<Gender | "">(initialValues.gender ?? (readOnly ? "" : "Male"));
  const [religion, setReligion] = useState<Religion | "">(initialValues.religion ?? (readOnly ? "" : "Hindu"));
  const [dateOfBirth, setDateOfBirth] = useState(initialValues.dateOfBirth ?? "");
  const [weddingDate, setWeddingDate] = useState(initialValues.weddingDate ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<CustomerDuplicate[]>([]);

  // Named, because Cancel and Submit sit in the dialog's header — outside this form's DOM subtree —
  // and a submit button reaches its form by id from there. Generated rather than a literal: the
  // Customers list has a create dialog and an edit dialog mounted at once, and two forms answering
  // to one id would have the second one's Submit driving the first.
  const formId = useId();

  const duplicateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Contact details the operator has already been warned about and chosen to keep. Without this
  // the dialog reappears every time the cursor leaves the field, which trains people to dismiss
  // it without reading — the one habit a duplicate warning cannot afford.
  const acknowledged = useRef(new Set<string>());

  useEffect(() => () => {
    if (duplicateTimer.current) {
      clearTimeout(duplicateTimer.current);
    }
  }, []);

  /**
   * Asks the server who else holds this number or email, once the operator has left the field.
   *
   * Failures are swallowed on purpose: this is an advisory check running while a form is being
   * filled in, and an error toast about a background lookup would interrupt the typing it exists
   * to protect. The save itself still enforces the rule.
   */
  function scheduleDuplicateCheck(phone: string, address: string) {
    // Nothing is being typed on a view, so there is no new duplicate to warn about — and the
    // fields are disabled, so this cannot fire anyway. Guarded rather than assumed.
    if (readOnly) {
      return;
    }

    if (duplicateTimer.current) {
      clearTimeout(duplicateTimer.current);
    }

    duplicateTimer.current = setTimeout(async () => {
      // A half-typed number matches nothing, so there is no point asking until it is one.
      const normalized = normalizePhoneNumber(phone);
      const searchPhone = normalized ?? "";
      const searchEmail = emailError(address) === null ? address.trim() : "";
      if (searchPhone === "" && searchEmail === "") {
        return;
      }

      const key = `${searchPhone}|${searchEmail.toLowerCase()}`;
      if (acknowledged.current.has(key)) {
        return;
      }

      try {
        const matches = await findCustomerDuplicates(searchPhone, searchEmail, getAccessToken(), customerId);
        if (matches.length > 0) {
          acknowledged.current.add(key);
          setDuplicates(matches);
        }
      } catch {
        // See above — an advisory check stays quiet when it cannot run.
      }
    }, DUPLICATE_CHECK_DELAY_MS);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Enter in a text field submits a form even with no submit button on screen. Without this, a
    // read-only view would still try to save.
    if (readOnly || !onSubmit) {
      return;
    }

    setFormError(null);
    setFieldErrors({});

    // Checked here as well as on the server so a mistyped number is caught under the cursor
    // rather than after a round trip. The server is still the authority.
    const clientErrors: Record<string, string> = {};
    const phoneProblem = phoneNumberError(phoneNumber);
    if (phoneProblem) {
      clientErrors.phonenumber = phoneProblem;
    }
    const emailProblem = emailError(email);
    if (emailProblem) {
      clientErrors.email = emailProblem;
    }
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        fullName,
        phoneNumber,
        email: email.trim() === "" ? null : email,
        address: address.trim() === "" ? null : address,
        notes: notes.trim() === "" ? null : notes,
        // Every one of these is optional — an unanswered field stays unanswered rather than
        // being defaulted to something the customer never told the shop.
        gender: gender === "" ? null : gender,
        religion: religion === "" ? null : religion,
        dateOfBirth: dateOfBirth === "" ? null : dateOfBirth,
        weddingDate: weddingDate === "" ? null : weddingDate,
      });
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
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col">
      {/* On the dialog's title line, beside the close button — the pair then costs the form no
          height at all, which is what gets the whole customer onto one phone screen. Outside a
          dialog (Customers › New Customer as a page) this falls back to a row above the fields.

          A view offers neither: there is nothing to save, and nothing to cancel out of. */}
      {!readOnly && (
        <ModalActions placement="header">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5"
          >
            CANCEL
          </Button>
          {/* form=, because the button is no longer inside the form it submits. */}
          <Button type="submit" form={formId} disabled={isSubmitting} className="px-3 py-1.5">
            {isSubmitting ? "Saving…" : "SUBMIT"}
          </Button>
        </ModalActions>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Input
            id="fullName"
            label="Customer name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullname}
            disabled={readOnly}
          />
        </div>
        <PhoneNumberInput
          id="phoneNumber"
          value={phoneNumber}
          onChange={setPhoneNumber}
          onBlur={() => scheduleDuplicateCheck(phoneNumber, email)}
          error={fieldErrors.phonenumber}
          disabled={readOnly}
        />

        {/* Two answers, both always on screen: a dropdown for a choice this small costs a tap to
            open and hides the alternative until it is opened. */}
        <div className="flex flex-col gap-1">
          <span id="gender-label" className="text-sm font-medium">
            Gender
          </span>
          <div role="radiogroup" aria-labelledby="gender-label" className="flex items-center gap-3 py-2">
            {GENDERS.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="gender"
                  value={option}
                  checked={gender === option}
                  onChange={() => setGender(option)}
                  disabled={readOnly}
                  className="h-4 w-4 accent-primary"
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        {/* Initials rather than words: three full names side by side do not fit half a phone
            screen, and the full name is on the control for anyone who hovers or listens. */}
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <span id="religion-label" className="text-sm font-medium">
            Religion
          </span>
          <div role="radiogroup" aria-labelledby="religion-label" className="flex gap-1.5">
            {(RELIGION_CHOICES.includes(religion as Religion) || religion === ""
              ? RELIGION_CHOICES
              : [...RELIGION_CHOICES, religion as Religion]
            ).map((option) => (
              <label key={option} className="min-w-11 flex-1 sm:max-w-16" title={option}>
                <input
                  type="radio"
                  name="religion"
                  value={option}
                  checked={religion === option}
                  onChange={() => setReligion(option)}
                  disabled={readOnly}
                  aria-label={option}
                  className="peer sr-only"
                />
                <span className={chipClassName}>{option.charAt(0)}</span>
              </label>
            ))}
          </div>
        </div>

        <DatePartsInput
          id="dateOfBirth"
          label="Date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          disabled={readOnly}
          className="col-span-2 sm:col-span-1"
        />
        <DatePartsInput
          id="weddingDate"
          label="Wedding date"
          value={weddingDate}
          onChange={setWeddingDate}
          disabled={readOnly}
          className="col-span-2 sm:col-span-1"
        />

        {/* Free text runs the full width in both layouts — an address squeezed into half a dialog
            wraps after three words. */}
        <div className="col-span-2">
          <Textarea
            id="address"
            label="Address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            error={fieldErrors.address}
            disabled={readOnly}
          />
        </div>
        <div className="col-span-2">
          <Textarea
            id="notes"
            label="Notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            error={fieldErrors.notes}
            disabled={readOnly}
          />
        </div>

        {/* Last, because it is the field customers most often do not have. Ending on it means the
            ones that matter are all answered before anybody stalls on this one. */}
        <div className="col-span-2 sm:col-span-1">
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => scheduleDuplicateCheck(phoneNumber, email)}
            error={fieldErrors.email}
            disabled={readOnly}
          />
        </div>
      </div>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {formError}
        </p>
      )}

      {/* Outside the field flow: the warning is about the record as a whole, and it must not push
          the form around while someone is typing in it. */}
      <DuplicateWarningModal
        matches={duplicates}
        onCreateAnyway={() => setDuplicates([])}
        onClose={() => setDuplicates([])}
      />
    </form>
  );
}
