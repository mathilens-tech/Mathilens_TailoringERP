import PageClient from "./PageClient";

// Static export requires generateStaticParams for dynamic segments (no server exists at
// request time to render unknown ids on-demand). This one prerendered page is served for every
// real id by the rewrites in staticwebapp.config.json. Note that the id below IS what
// useParams() returns in a built app — the router tree is the prerendered one — so PageClient
// must read the id from the URL via useRouteId(), never from useParams().
//
// Singular "/dashboard/employee/{id}" rather than nesting a /view under the plural list route:
// Azure Static Web Apps only matches a wildcard at the *end* of a route, so no rule can express
// "/dashboard/employees/*/view" — the existing "/dashboard/employees/*" rule would swallow it and
// serve the edit page instead. Keeping the id last means one ordinary rewrite covers it.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <PageClient />;
}
