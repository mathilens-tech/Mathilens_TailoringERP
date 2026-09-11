"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CustomerDuplicate } from "@/lib/api/customers";
import { toDisplayPhoneNumber } from "@/lib/contact";

/**
 * Warns that a contact detail being typed already belongs to someone (FR-04).
 *
 * <p>Raised as the operator leaves the phone or email field rather than on save, because the point
 * of it is to be early: the cost of a duplicate customer is not the failed save, it is the second
 * record that gets orders attached to it and has to be merged later.</p>
 *
 * <p>Two different warnings wear the same dialog. A shared <b>email</b> is advisory — families use
 * one address, so the operator can carry on. A shared <b>phone number</b> is not: it is the key the
 * shop, the spreadsheet import and the WhatsApp module all identify a customer by, the server
 * enforces it, and a save would be refused. Offering "Create anyway" there would be a button whose
 * only outcome is an error, so it isn't offered — the way forward is the existing record or a
 * corrected number.</p>
 */
export function DuplicateWarningModal({
  matches,
  onCreateAnyway,
  onClose,
}: {
  /** Empty closes the dialog — the caller clears it once the warning has been dealt with. */
  matches: CustomerDuplicate[];
  /** Dismiss and keep going. Absent when a phone number matched, since the save would fail. */
  onCreateAnyway: () => void;
  onClose: () => void;
}) {
  const blockedByPhoneNumber = matches.some((m) => m.matchesPhoneNumber);

  return (
    <Modal
      open={matches.length > 0}
      title={blockedByPhoneNumber ? "This number is already on file" : "Possible duplicate"}
      icon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70">
          {blockedByPhoneNumber
            ? "A customer with this mobile number already exists, so this record cannot be saved with it. Open the existing customer, or enter a different number."
            : "Someone on file already uses this email address. That may be intentional — families often share one."}
        </p>

        <ul className="flex flex-col gap-2">
          {matches.map((match) => (
            <li
              key={match.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{match.fullName}</p>
                <p className="truncate text-foreground/70">
                  {toDisplayPhoneNumber(match.phoneNumber)}
                  {match.email && ` · ${match.email}`}
                </p>
              </div>
              {/* What matched, so the operator isn't left comparing two records by eye to work
                  out why this one was raised. */}
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {match.matchesPhoneNumber ? "Same number" : "Same email"}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {blockedByPhoneNumber ? "Change the number" : "Cancel"}
          </Button>
          {/* One match is a record to open; several is a list to go and look at. */}
          {matches.length === 1 && (
            <Link
              href={`/dashboard/customers/${matches[0].id}`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
            >
              View existing
            </Link>
          )}
          {!blockedByPhoneNumber && (
            <Button type="button" onClick={onCreateAnyway}>
              Create anyway
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
