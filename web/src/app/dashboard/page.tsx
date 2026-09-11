import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { OrderStatusCounts } from "@/components/dashboard/OrderStatusCounts";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/dashboard/orders/new">
          <Button type="button">New Order</Button>
        </Link>
      </div>

      <OrderStatusCounts />
    </div>
  );
}
