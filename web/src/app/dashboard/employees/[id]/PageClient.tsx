"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmployeeForm } from "../EmployeeForm";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { ApiError } from "@/lib/api-client";
import { getEmployee, updateEmployee, type Employee, type EmployeeInput } from "@/lib/api/employees";

export default function EditEmployeePage() {
  const employeeId = useRouteId();
  const router = useRouter();
  const { showToast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getEmployee(employeeId, getAccessToken())
      .then((data) => {
        if (!cancelled) {
          setEmployee(data);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Unable to load this employee.");
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function handleUpdate(input: EmployeeInput) {
    await updateEmployee(employeeId, input, getAccessToken());
    showToast("Employee updated.");
    router.push("/dashboard/employees");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Employee</h1>
        <Link href="/dashboard/employees" className="text-sm text-foreground/70 hover:text-foreground">
          Back to employees
        </Link>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : !employee ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : (
        <div className="max-w-2xl rounded-lg border border-border bg-surface p-4 sm:p-6">
          <EmployeeForm
            initialValues={{
              employeeCode: employee.employeeCode,
              joiningDate: employee.joiningDate,
              employmentType: employee.employmentType,
              fullName: employee.fullName,
              jobTitle: employee.jobTitle,
              phoneNumber: employee.phoneNumber,
              email: employee.email,
            }}
            onSubmit={handleUpdate}
            onCancel={() => router.push("/dashboard/employees")}
          />
        </div>
      )}
    </div>
  );
}
