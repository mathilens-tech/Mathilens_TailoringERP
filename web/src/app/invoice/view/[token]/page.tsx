import PageClient from "./PageClient";

// Static export requires generateStaticParams for dynamic segments (no server exists at request
// time to render unknown tokens on-demand). This one prerendered page is served for every real
// token by the rewrite in staticwebapp.config.json. As on the other [id] routes, the value below
// IS what useParams() would return in a built app, so PageClient reads the token from the URL via
// useRouteId() instead.
export function generateStaticParams() {
  return [{ token: "_" }];
}

export default function Page() {
  return <PageClient />;
}
