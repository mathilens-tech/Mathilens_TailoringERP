"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CustomerForm } from "../CustomerForm";
import { MeasurementsSection } from "./MeasurementsSection";
import { PreviousOrdersSection } from "./PreviousOrdersSection";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { ApiError } from "@/lib/api-client";
import { getCustomer, type Customer } from "@/lib/api/customers";

export default function ViewCustomerPage() {
  const customerId = useRouteId();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCustomer(customerId, getAccessToken())
      .then((data) => {
        if (!cancelled) {
          setCustomer(data);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Unable to load this customer.");
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A view, not an edit form: editing happens in the dialog on the list, where the person
            being changed is named. This page is what the list links to for their orders and
            measurements, and it shows their details rather than asking for them. */}
        <h1 className="text-2xl font-semibold">{customer?.fullName ?? "Customer"}</h1>
        <Link href="/dashboard/customers" className="text-sm text-foreground/70 hover:text-foreground">
          Back to customers
        </Link>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : !customer ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
            <CustomerForm
              customerId={customerId}
              initialValues={{
                fullName: customer.fullName,
                phoneNumber: customer.phoneNumber,
                email: customer.email,
                address: customer.address,
                notes: customer.notes,
                gender: customer.gender,
                religion: customer.religion,
                dateOfBirth: customer.dateOfBirth,
                weddingDate: customer.weddingDate,
              }}
              readOnly
            />
          </div>

          {/* Orders before measurements: this page is reached from the phone number on the list,
              and "what have we made for them" is the question that click is usually asking. */}
          <PreviousOrdersSection customerId={customerId} />

          <MeasurementsSection customerId={customerId} />
        </div>
      )}
    </div>
  );
}
