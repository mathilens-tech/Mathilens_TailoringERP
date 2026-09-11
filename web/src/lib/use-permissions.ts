"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getCurrentUser, type CurrentUser } from "@/lib/api/users";

export type PermissionState = {
  user: CurrentUser | null;
  /** False until /me has answered, so screens can wait rather than flashing content the user may not be allowed to see. */
  isLoaded: boolean;
  can: (permission: string) => boolean;
};

/**
 * The caller's permissions, used to decide which screens and actions to offer.
 *
 * This is presentation only. Every endpoint enforces the same permissions independently, so a
 * hidden button is a courtesy to the user, never the thing that stops them — someone calling the
 * API directly gets a 403 regardless of what the UI rendered.
 */
export function usePermissions(): PermissionState {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(async () => {
    setUser(await getCurrentUser(getAccessToken()).catch(() => null));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const can = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  return { user, isLoaded, can };
}
