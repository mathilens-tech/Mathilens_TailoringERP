import PageClient from "./PageClient";

// Static export requires generateStaticParams for dynamic segments (no server exists at
// request time to render unknown ids on-demand). This one prerendered page is served for every
// real id by the rewrites in staticwebapp.config.json. Note that the id below IS what
// useParams() returns in a built app — the router tree is the prerendered one — so PageClient
// must read the id from the URL via useRouteId(), never from useParams().
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <PageClient />;
}
