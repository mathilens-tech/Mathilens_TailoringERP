"use client";

import { useSearchParams } from "next/navigation";

/**
 * Explains an involuntary sign-out.
 *
 * Its own component, and rendered inside a Suspense boundary, because useSearchParams opts the
 * component that calls it out of static rendering. Reading it here rather than in the page keeps
 * that bailout to this one line of text instead of the whole login screen, which this app exports
 * statically.
 */
const MESSAGES: Record<string, string> = {
  superseded:
    "You were signed out because this account signed in somewhere else. Only one device can be signed in at a time.",
  expired: "Your session has expired. Please sign in again.",
};

export function SessionEndedNotice() {
  const reason = useSearchParams().get("ended");
  const message = reason ? MESSAGES[reason] : undefined;

  if (!message) {
    return null;
  }

  return (
    <p role="alert" className="mt-5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
      {message}
    </p>
  );
}
