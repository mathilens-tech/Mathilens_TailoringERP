"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Settings has no page of its own any more — it is a menu group, and its children are real routes.
 *
 * This exists only to catch anyone arriving at the bare /dashboard/settings, from a bookmark or an
 * old link, and send them somewhere useful. Appearance is the target because it is the one child
 * every role can open: Front Desk and Tailor hold no Settings.View, so landing them on Order
 * Duration would be a 403 dressed as a page.
 */
export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings/appearance");
  }, [router]);

  return null;
}
