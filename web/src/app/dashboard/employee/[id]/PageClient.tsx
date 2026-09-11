"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { usePermissions } from "@/lib/use-permissions";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/api/users";
import { EmployeeForm } from "../../employees/EmployeeForm";
import {
  getEmployee,
  getEmployeeOrders,
  retireEmployee,
  updateEmployee,
  isRetired,
  EMPLOYMENT_TYPE_LABELS,
  type Employee,
  type EmployeeOrder,
} from "@/lib/api/employees";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { DateInput } from "@/components/ui/DateInput";

/** yyyy-MM-dd off the local calendar, for date inputs and defaults. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** A date-only value from the API is already yyyy-MM-dd; parsing it as UTC avoids a day-shift. */
function formatDate(isoDate: string | null): string {
  return isoDate ? new Date(`${isoDate}T00:00:00Z`).toLocaleDateString() : "—";
}

/** Timestamps are real instants, so they render in the reader's own zone. */
function formatInstant(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-foreground/50">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

/**
 * Everything about one employee: who they are on top, and every order they have worked below.
 *
 * The order table reports the work timestamps the order workflow records — when the job was picked
 * up and when it was finished — which is not the same as when the customer collected it.
 */
export default function EmployeeViewPage() {
  const employeeId = useRouteId();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showRetire, setShowRetire] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [lastWorkingDate, setLastWorkingDate] = useState(todayIsoDate);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);

  // Retiring and bringing someone back are the only things this page changes, so it asks for
  // exactly that right rather than for staff editing as a whole.
  const canManage = can(PERMISSIONS.employeesRetire);
  const canEdit = can(PERMISSIONS.employeesEdit);

  const loadEmployee = useCallback(async () => {
    try {
      setEmployee(await getEmployee(employeeId, getAccessToken()));
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load this employee.");
    }
  }, [employeeId]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { items, meta } = await getEmployeeOrders(employeeId, page, pageSize, getAccessToken());
      setOrders(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load this employee's orders.");
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmployee();
  }, [loadEmployee]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, [loadOrders]);

  async function handleRetire(returnToWork: boolean) {
    setRetireError(null);
    setIsRetiring(true);
    try {
      const updated = await retireEmployee(employeeId, returnToWork ? null : lastWorkingDate, getAccessToken());
      setEmployee(updated);
      setShowRetire(false);
      showToast(returnToWork ? `${updated.fullName} is back on the active roster.` : `${updated.fullName} retired.`);
    } catch (error) {
      setRetireError(error instanceof ApiError ? error.message : "Unable to update this employee.");
    } finally {
      setIsRetiring(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {loadError}
      </p>
    );
  }

  if (!employee) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
          <p className="mt-1 text-sm text-foreground/70">
            {employee.employeeCode}
            {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
          </p>
        </div>
        {/* Wraps rather than overflowing: four controls do not fit a phone on one line. */}
        <div className="flex flex-wrap items-center gap-3">
          {canManage && isRetired(employee) && (
            <Button type="button" variant="secondary" onClick={() => handleRetire(true)} disabled={isRetiring}>
              Return to work
            </Button>
          )}
          {canManage && !isRetired(employee) && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLastWorkingDate(todayIsoDate());
                setRetireError(null);
                setShowRetire(true);
              }}
            >
              Retire
            </Button>
          )}
          {/* Edits here instead of navigating to the edit page, so the order history and scroll
              position survive a change of phone number. */}
          {canEdit && (
            <Button type="button" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
          )}
          <Link href="/dashboard/employees" className="text-sm text-foreground/70 hover:text-foreground">
            Back to employees
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Employee code" value={employee.employeeCode} />
          <Detail label="Phone" value={toDisplayPhoneNumber(employee.phoneNumber)} />
          <Detail label="Email" value={employee.email ?? "—"} />
          <Detail label="Job title" value={employee.jobTitle ?? "—"} />
          <Detail label="Joining date" value={formatDate(employee.joiningDate)} />
          <Detail label="Employment type" value={EMPLOYMENT_TYPE_LABELS[employee.employmentType]} />
          <Detail label="Last working date" value={formatDate(employee.lastWorkingDate)} />
          {/* Recorded standing, not "still employed today" — see isRetired. */}
          <Detail
            label="Status"
            value={
              isRetired(employee) ? (
                <span className="text-foreground/60">Retired</span>
              ) : (
                <span className="text-success">Active</span>
              )
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Order History</h2>

        {isLoading ? (
          <p className="text-sm text-foreground/70">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-foreground/70">No orders have been assigned to this employee yet.</p>
        ) : (
          <div className="table-wrap overflow-x-auto rounded-lg border border-border">
            <table className="stacked w-full text-left text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Collection</th>
                  <th className="px-4 py-3 font-medium">Work started</th>
                  <th className="px-4 py-3 font-medium">Work finished</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.orderId} className="border-b border-border last:border-0">
                    <td data-label="Order" className="px-4 py-3 whitespace-nowrap font-mono">
                      <Link href={`/dashboard/orders/${order.orderId}`} className="hover:text-primary">
                        #{order.orderId.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td data-label="Customer" className="px-4 py-3">{order.customerName}</td>
                    <td data-label="Items" className="px-4 py-3">{order.itemCount}</td>
                    <td data-label="Status" className="px-4 py-3 whitespace-nowrap">{order.status}</td>
                    <td data-label="Collection" className="px-4 py-3 whitespace-nowrap">{formatInstant(order.dueAtUtc)}</td>
                    <td data-label="Work started" className="px-4 py-3 whitespace-nowrap">{formatInstant(order.workStartedAtUtc)}</td>
                    <td data-label="Work finished" className="px-4 py-3 whitespace-nowrap">{formatInstant(order.workCompletedAtUtc)}</td>
                    <td data-label="Delivered" className="px-4 py-3 whitespace-nowrap">{formatInstant(order.deliveredAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <Pagination
            meta={meta}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* The same dialog the list uses, so retiring reads identically wherever it is done. */}
      <Modal open={showRetire} title="Retire Employee" onClose={() => setShowRetire(false)}>
        <div className="flex flex-col">
          <p className="text-sm text-foreground/70">
            {employee.fullName} — takes them off the list for new work. Nothing is deleted, and this can be undone.
          </p>
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor="lastWorkingDate" className="text-sm font-medium">
              Last working date
            </label>
            <DateInput
              id="lastWorkingDate"
              value={lastWorkingDate}
              min={employee.joiningDate}
              onChange={setLastWorkingDate}
            />
          </div>

          {retireError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {retireError}
            </p>
          )}

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowRetire(false)} disabled={isRetiring}>
              CANCEL
            </Button>
            <Button type="button" onClick={() => handleRetire(false)} disabled={isRetiring}>
              {isRetiring ? "Saving…" : "CONFIRM"}
            </Button>
          </ModalActions>
        </div>
      </Modal>

      {/* Keyed on the record so reopening after a save seeds the fields from what was stored, not
          from the values the form mounted with. */}
      <Modal open={showEdit} title="Edit Employee" onClose={() => setShowEdit(false)}>
        <EmployeeForm
          key={`${employee.id}-${employee.phoneNumber}-${employee.fullName}`}
          initialValues={{
            employeeCode: employee.employeeCode,
            joiningDate: employee.joiningDate,
            employmentType: employee.employmentType,
            fullName: employee.fullName,
            jobTitle: employee.jobTitle,
            phoneNumber: employee.phoneNumber,
            email: employee.email,
          }}
          onCancel={() => setShowEdit(false)}
          onSubmit={async (input) => {
            setEmployee(await updateEmployee(employee.id, input, getAccessToken()));
            showToast("Employee updated.");
            setShowEdit(false);
          }}
        />
      </Modal>
    </div>
  );
}
