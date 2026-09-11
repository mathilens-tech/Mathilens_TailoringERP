import { apiGet, apiGetPaged, apiPost, apiPut } from "@/lib/api-client";

export const EMPLOYMENT_TYPES = ["FullTime", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** How the enum reads on screen — the wire values are single words, people are not. */
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FullTime: "Full time",
  Contract: "Contract",
};

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  jobTitle: string | null;
  phoneNumber: string;
  email: string | null;
  /** yyyy-MM-dd */
  joiningDate: string;
  employmentType: EmploymentType;
  /** yyyy-MM-dd, or null while they are still employed. */
  lastWorkingDate: string | null;
  /** Resolved server-side against today, so every screen agrees who is still employed. */
  isActive: boolean;
  createdAtUtc: string;
};

/**
 * Retirement has been recorded for this person.
 *
 * Not the same question as `isActive`, which the server answers as "still employed *today*". Retiring
 * someone with today as their last working day leaves `isActive` true until midnight, so a screen
 * reading it showed "Active" immediately after the shop pressed Retire. Every screen that reports
 * standing asks this instead; anything deciding whether they may be given work today still wants
 * `isActive`.
 */
export function isRetired(employee: Employee): boolean {
  return employee.lastWorkingDate !== null;
}

export type EmployeeInput = {
  employeeCode: string;
  fullName: string;
  jobTitle: string | null;
  phoneNumber: string;
  email: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
};

/** One order this employee worked, as the history table on their view screen shows it. */
export type EmployeeOrder = {
  orderId: string;
  customerName: string;
  status: string;
  itemCount: number;
  createdAtUtc: string;
  dueAtUtc: string;
  /** When it moved to In Progress — null if they have not begun. */
  workStartedAtUtc: string | null;
  /** When it moved to Ready For Delivery, which is not the same as being collected. */
  workCompletedAtUtc: string | null;
  deliveredAtUtc: string | null;
};

export function searchEmployees(search: string, page: number, pageSize: number, token: string | null) {
  // Search matches name, employee code or phone — the three things staff know a colleague by.
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }
  return apiGetPaged<Employee>(`/api/v1/employees?${params}`, token);
}

export function getEmployee(id: string, token: string | null) {
  return apiGet<Employee>(`/api/v1/employees/${id}`, token);
}

export function createEmployee(input: EmployeeInput, token: string | null) {
  return apiPost<Employee>("/api/v1/employees", input, token);
}

export function updateEmployee(id: string, input: EmployeeInput, token: string | null) {
  return apiPut<Employee>(`/api/v1/employees/${id}`, input, token);
}

/** Pass null to put someone back on the active roster. */
export function retireEmployee(id: string, lastWorkingDate: string | null, token: string | null) {
  return apiPost<Employee>(`/api/v1/employees/${id}/retire`, { lastWorkingDate }, token);
}

export function getEmployeeOrders(id: string, page: number, pageSize: number, token: string | null) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiGetPaged<EmployeeOrder>(`/api/v1/employees/${id}/orders?${params}`, token);
}
