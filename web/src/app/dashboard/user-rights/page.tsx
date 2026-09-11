"use client";

import { RoleRightsSection } from "../settings/RoleRightsSection";

/**
 * What each role is allowed to do.
 *
 * Its own screen rather than a section of Settings, and gated on Users.Rights rather than
 * Settings.View — matching the API, which guards the role-permission endpoints with Users.Rights
 * precisely so that a Manager holding Settings.Manage cannot grant themselves the right to hand out
 * access. On the old Settings page a Manager could open the editor and every save came back 403.
 */
export default function UserRightsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">User Rights</h1>
      <RoleRightsSection />
    </div>
  );
}
