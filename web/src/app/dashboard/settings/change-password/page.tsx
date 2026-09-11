"use client";

import { ChangePasswordForm } from "@/components/users/ChangePasswordForm";

/**
 * The standalone route, kept so a bookmark from before this became a dialog keeps working.
 *
 * The profile menu at the foot of the nav rail is how anyone reaches it now, and that opens the
 * same form in a dialog rather than sending them to this page.
 */
export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Change Password</h1>

      <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
