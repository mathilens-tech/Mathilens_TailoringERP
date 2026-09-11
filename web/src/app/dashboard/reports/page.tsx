"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Reports has no page of its own — it is a menu group whose children are real screens.
 *
 * This catches anyone arriving at the bare /dashboard/reports from a bookmark or an older link and
 * sends them to the first child, which is where the page they remember now lives.
 */
export default function ReportsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/reports/order-collections");
  }, [router]);

  return null;
}
