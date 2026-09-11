"use client";

import { usePathname } from "next/navigation";

/**
 * Reads a dynamic route's id from the URL the user actually navigated to.
 *
 * Do not reach for `useParams()` here. This app is a static export (next.config.ts
 * `output: "export"`), so each `[id]` route is prerendered exactly once under the placeholder
 * id returned by `generateStaticParams()` and then served for every real id via the rewrites in
 * staticwebapp.config.json. `useParams()` derives its value from the router state tree, and in
 * an exported build that tree is the prerendered one — it literally contains `["id","_","d"]`
 * — so it returns the placeholder no matter which id was requested. It only appears to work
 * under `next dev`, where a server fills the segment in per request.
 *
 * `usePathname()` is derived from the router's canonical URL, which the client initializes from
 * `window.location`, so it always reflects the real address.
 *
 * @param offsetFromEnd How many segments sit after the id. 0 for `/customers/[id]`, 1 for
 *   `/measurements/[id]/history`.
 */
export function useRouteId(offsetFromEnd = 0): string {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1 - offsetFromEnd] ?? "";
}
