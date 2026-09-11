"use client";

import { OccasionReport } from "../OccasionReport";

export default function WeddingReportPage() {
  return (
    <OccasionReport
      occasion="WeddingAnniversary"
      title="Wedding"
      description="Customers with a wedding anniversary coming up. Anniversaries drive occasion wear, so this is the list worth working through before the date."
      milestoneLabel="Years"
    />
  );
}
