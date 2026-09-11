"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { ImportExportButtons } from "@/components/ui/ImportExportButtons";
import { Modal } from "@/components/ui/Modal";
import { EmployeeForm } from "./EmployeeForm";
import { useToast } from "@/components/ui/ToastProvider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import {
  createEmployee,
  searchEmployees,
  retireEmployee,
  updateEmployee,
  isRetired,
  EMPLOYMENT_TYPE_LABELS,
  type Employee,
} from "@/lib/api/employees";
import { toDisplayPhoneNumber } from "@/lib/contact";
import { DateInput } from "@/components/ui/DateInput";

/** yyyy-MM-dd off the local calendar — a last working day is a day in the shop, not a UTC instant. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}


export default function EmployeesPage() {
  const { showToast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  // Held whole rather than by id: the list already carries every field the form asks for, so
  // opening the dialog costs no request and shows no loading state.
  const [editing, setEditing] = useState<Employee | null>(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Employees are retired, never deleted: their order history has to stay readable, and their
  // code and phone stay theirs so an old job card still resolves to the right person.
  const [pendingRetire, setPendingRetire] = useState<Employee | null>(null);
  const [lastWorkingDate, setLastWorkingDate] = useState(todayIsoDate);
  const [isRetiring, setIsRetiring] = useState(false);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchEmployees(debouncedSearch, page, pageSize, getAccessToken());
      setEmployees(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load employees.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmployees();
  }, [loadEmployees]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  async function handleConfirmRetire() {
    if (!pendingRetire) {
      return;
    }

    setIsRetiring(true);
    try {
      await retireEmployee(pendingRetire.id, lastWorkingDate, getAccessToken());
      showToast(`${pendingRetire.fullName} retired.`);
      setPendingRetire(null);
      await loadEmployees();
    } catch (error) {
      // The server refuses a date before their joining date — its message says so, show it as-is.
      showToast(error instanceof ApiError ? error.message : "Unable to retire this employee.", "error");
    } finally {
      setIsRetiring(false);
    }
  }

  async function handleReturnToWork(employee: Employee) {
    try {
      await retireEmployee(employee.id, null, getAccessToken());
      showToast(`${employee.fullName} is back on the active roster.`);
      await loadEmployees();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Unable to update this employee.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <div className="flex flex-wrap items-start gap-2">
          <ImportExportButtons resource="employees" label="employees" onImported={loadEmployees} />
          {/* Opens in place rather than navigating, so adding a member of staff does not cost the
              page position and filters. /dashboard/employees/new still works. */}
          <Button type="button" aria-label="New employee" onClick={() => setIsAdding(true)}>
            New
          </Button>
        </div>
      </div>

      <Input
        id="search"
        label="Search by name, code or phone"
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search employees…"
        autoCapitalize="none"
      />

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-foreground/70">No employees found.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Job Title</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-border last:border-0">
                  <td data-label="Code" className="px-4 py-3 font-mono">
                    {employee.employeeCode}
                  </td>
                  <td data-label="Name" className="px-4 py-3 font-medium">
                    {employee.fullName}
                  </td>
                  <td data-label="Job Title" className="px-4 py-3">
                    {employee.jobTitle ?? "—"}
                  </td>
                  <td data-label="Phone" className="px-4 py-3">
                    {toDisplayPhoneNumber(employee.phoneNumber)}
                  </td>
                  <td data-label="Type" className="px-4 py-3 whitespace-nowrap">
                    {EMPLOYMENT_TYPE_LABELS[employee.employmentType]}
                  </td>
                  <td data-label="Joined" className="px-4 py-3 whitespace-nowrap">
                    {new Date(`${employee.joiningDate}T00:00:00Z`).toLocaleDateString()}
                  </td>
                  {/* Reads the recorded last working day, not isActive — see isRetired for why
                      pressing Retire used to leave the row saying Active for the rest of the day. */}
                  <td data-label="Status" className="px-4 py-3 whitespace-nowrap">
                    {isRetired(employee) ? (
                      <span className="text-foreground/60">
                        Retired {new Date(`${employee.lastWorkingDate}T00:00:00Z`).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-success">Active</span>
                    )}
                  </td>
                  <td data-label="" className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-3">
                      <Link href={`/dashboard/employee/${employee.id}`} className="text-foreground/70 hover:text-foreground">
                        View
                      </Link>
                      {/* In place, like New — editing from the list no longer costs the page
                          position and the search term. */}
                      <button
                        type="button"
                        onClick={() => setEditing(employee)}
                        className="text-foreground/70 hover:text-foreground"
                      >
                        Edit
                      </button>
                      {!isRetired(employee) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingRetire(employee);
                            setLastWorkingDate(todayIsoDate());
                          }}
                          className="text-foreground/70 hover:text-foreground"
                        >
                          Retire
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReturnToWork(employee)}
                          className="text-foreground/70 hover:text-foreground"
                        >
                          Return to work
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />}

      {/* Retiring needs a date, which a plain confirm dialog cannot ask for. */}
      {pendingRetire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="retireTitle"
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-4 sm:p-6"
          >
            {/* A fixed title with the name below it, rather than "Retire Kavitha" as the heading —
                the dialog is the same one every time, and the name is who it applies to. */}
            <h2 id="retireTitle" className="text-lg font-semibold">
              Retire Employee
            </h2>
            <p className="mt-1 text-sm text-foreground/70">
              {pendingRetire.fullName} — takes them off the list for new work. Nothing is deleted, and this can be
              undone.
            </p>
            <div className="mt-4 flex flex-col gap-1">
              <label htmlFor="retireDate" className="text-sm font-medium">
                Last working date
              </label>
              <DateInput
                id="retireDate"
                value={lastWorkingDate}
                min={pendingRetire.joiningDate}
                onChange={setLastWorkingDate}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingRetire(null)}
                className="text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <Button type="button" onClick={handleConfirmRetire} disabled={isRetiring}>
                {isRetiring ? "Saving…" : "Retire"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal open={isAdding} title="New Employee" onClose={() => setIsAdding(false)}>
        <EmployeeForm
          onCancel={() => setIsAdding(false)}
          onSubmit={async (input) => {
            await createEmployee(input, getAccessToken());
            showToast("Employee created.");
            setIsAdding(false);
            await loadEmployees();
          }}
        />
      </Modal>

      {/* Keyed on the employee so the form remounts per row — without it, opening a second person
          would show the first one's values, since the fields are seeded from props on mount only. */}
      <Modal open={editing !== null} title="Edit Employee" onClose={() => setEditing(null)}>
        {editing && (
          <EmployeeForm
            key={editing.id}
            initialValues={{
              employeeCode: editing.employeeCode,
              joiningDate: editing.joiningDate,
              employmentType: editing.employmentType,
              fullName: editing.fullName,
              jobTitle: editing.jobTitle,
              phoneNumber: editing.phoneNumber,
              email: editing.email,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await updateEmployee(editing.id, input, getAccessToken());
              showToast("Employee updated.");
              setEditing(null);
              await loadEmployees();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
