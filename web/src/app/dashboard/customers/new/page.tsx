"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerForm } from "../CustomerForm";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { createCustomer, type CustomerInput } from "@/lib/api/customers";

export default function NewCustomerPage() {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleCreate(input: CustomerInput) {
    await createCustomer(input, getAccessToken());
    showToast("Customer created.");
    router.push("/dashboard/customers");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Customer</h1>
        <Link href="/dashboard/customers" className="text-sm text-foreground/70 hover:text-foreground">
          Back to customers
        </Link>
      </div>
      <div className="max-w-2xl rounded-lg border border-border bg-surface p-4 sm:p-6">
        <CustomerForm onSubmit={handleCreate} onCancel={() => router.push("/dashboard/customers")} />
      </div>
    </div>
  );
}
