import type { NextConfig } from "next";

// `next dev` enforces the static-export contract as strictly as a build does: a dynamic segment
// may only be visited with an id that generateStaticParams() returned. Every [id] route here
// prerenders a single placeholder ("_") and relies on the Azure Static Web Apps rewrites in
// staticwebapp.config.json to serve it for real ids — a layer that does not exist locally. With
// `output: "export"` applied in development, opening any detail page (Edit customer, Edit
// employee, an order, an invoice) fails with "is missing param ... in generateStaticParams()".
//
// Dropping the option in development restores on-demand rendering of those segments, which is
// only how the page gets reached locally — it changes nothing about the deployed artifact, since
// `next build` still exports. Pages must keep reading ids via useRouteId() rather than
// useParams(), for the reasons documented there; that is unaffected either way.
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Azure Static Web Apps' managed Next.js SSR hosting doesn't reliably run this app's
  // Next.js version — and this app has no server dependencies (no middleware, no route
  // handlers, every dynamic bit is a client-side call to the external .NET API), so a
  // static export removes that fragile layer entirely.
  ...(isDevelopment ? {} : { output: "export" as const }),

  // Mobile layout work has to be done on a real phone — iOS focus-zoom, touch targets and the
  // stacked tables cannot be judged from a desktop browser at a narrow width. That means opening
  // the dev server over the LAN, and Next blocks cross-origin requests to /_next/* by default, so
  // the page loads but hot reload silently does not: you edit, nothing happens, and the phone is
  // showing a stale bundle you then debug for ten minutes.
  //
  // Development only, and private ranges only — this never applies to the exported build.
  ...(isDevelopment
    ? { allowedDevOrigins: ["192.168.1.5", "192.168.1.*", "10.0.0.*", "172.16.*.*"] }
    : {}),
};

export default nextConfig;
