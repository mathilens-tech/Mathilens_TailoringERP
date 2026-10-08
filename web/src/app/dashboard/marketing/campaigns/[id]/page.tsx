import CampaignView from "./CampaignView";

// Static export needs a param for the dynamic segment; the single prerendered page is served for
// every real id by the rewrites, and the client reads the id from the URL via useRouteId().
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <CampaignView />;
}
