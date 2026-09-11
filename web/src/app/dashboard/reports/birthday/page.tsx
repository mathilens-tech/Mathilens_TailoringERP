"use client";

import { OccasionReport } from "../OccasionReport";

export default function BirthdayReportPage() {
  return (
    <OccasionReport
      occasion="Birthday"
      title="Birthday"
      description="Customers with a birthday coming up, so the shop can call before the day rather than after it. Mark each one once you have spoken to them, and note what came of it."
      milestoneLabel="Turning"
    />
  );
}
