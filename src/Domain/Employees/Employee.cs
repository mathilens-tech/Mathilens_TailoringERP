using MathilensERP.Domain.Common;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Employees;

/// <summary>
/// A staff member of the tailoring shop (02_DATABASE.md § 10.6) — the entity `Orders` are
/// assigned to for work tracking once the Tailoring Orders module exists.
///
/// <see cref="UserId"/> is the schema's place for the optional one-to-one link to a system
/// login (<c>Users</c>/<c>ApplicationUser</c>), per 02_DATABASE.md § 10.6 Relationships — but
/// no command in this module sets it yet. Linking an employee to a login account is an
/// admin/role-management flow, and that flow was already deferred in Phase 1
/// (03_ROADMAP.md: "admin role-management deferred to Phase 2 once a live database is
/// available to verify startup seeding against"), which remains true here for the same reason.
/// </summary>
public sealed class Employee : AuditableEntity
{
    /// <summary>The shop's own staff identifier (e.g. "EMP-014") — assigned by the shop, unique
    /// across live employees, and how staff refer to each other on a job card rather than by a
    /// system id nobody can read out loud.</summary>
    public string EmployeeCode { get; private set; } = string.Empty;

    public string FullName { get; private set; } = string.Empty;

    /// <summary>The employee's function in the shop (e.g. "Master Tailor", "Cutter") — free
    /// text, distinct from the system's RBAC <c>Roles</c> (02_DATABASE.md § 10.2).</summary>
    public string? JobTitle { get; private set; }

    /// <summary>Required, and unique across live staff — how the shop reaches a tailor about a job.</summary>
    public string PhoneNumber { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    /// <summary>The day they started. Date only — a shop records the day someone joined, not the hour.</summary>
    public DateOnly JoiningDate { get; private set; }

    public EmploymentType EmploymentType { get; private set; }

    /// <summary>
    /// Their last day, once they have left. Null while they are still employed.
    ///
    /// Retirement is deliberately not a soft delete: the person's order history has to stay
    /// readable, and their code and phone number stay theirs so an old job card still resolves to
    /// the right person. What it does change is that they can no longer be given new work.
    /// </summary>
    public DateOnly? LastWorkingDate { get; private set; }

    public Guid? UserId { get; private set; }

    /// <summary>
    /// Still employed as of <paramref name="today"/>. The date is passed in rather than read off
    /// the clock so the answer is the caller's "today" — a shop in India closing its books at
    /// 23:00 is not yet on UTC's tomorrow.
    /// </summary>
    public bool IsActiveOn(DateOnly today) => LastWorkingDate is not { } last || today <= last;

    private Employee()
    {
        // Reserved for EF Core materialization.
    }

    private Employee(Guid id)
        : base(id)
    {
    }

    public static Employee Create(
        string employeeCode,
        string fullName,
        string? jobTitle,
        string phoneNumber,
        string? email,
        DateOnly joiningDate,
        EmploymentType employmentType)
    {
        var employee = new Employee(Guid.NewGuid());
        employee.SetDetails(employeeCode, fullName, jobTitle, phoneNumber, email, joiningDate, employmentType);
        return employee;
    }

    public void UpdateDetails(
        string employeeCode,
        string fullName,
        string? jobTitle,
        string phoneNumber,
        string? email,
        DateOnly joiningDate,
        EmploymentType employmentType) =>
        SetDetails(employeeCode, fullName, jobTitle, phoneNumber, email, joiningDate, employmentType);

    /// <summary>
    /// Records that they have left, as of <paramref name="lastWorkingDate"/>. Refused before their
    /// joining date, which would describe an employment that ran backwards.
    /// </summary>
    public void Retire(DateOnly lastWorkingDate)
    {
        if (lastWorkingDate < JoiningDate)
        {
            throw new ArgumentException(
                $"Last working date {lastWorkingDate:yyyy-MM-dd} is before the joining date {JoiningDate:yyyy-MM-dd}.",
                nameof(lastWorkingDate));
        }

        LastWorkingDate = lastWorkingDate;
    }

    /// <summary>Undoes a retirement — someone recorded as leaving who did not, or who came back.</summary>
    public void ReturnToWork() => LastWorkingDate = null;

    private void SetDetails(
        string employeeCode,
        string fullName,
        string? jobTitle,
        string phoneNumber,
        string? email,
        DateOnly joiningDate,
        EmploymentType employmentType)
    {
        // Trimmed because the code and phone are both compared for uniqueness — a trailing space
        // must not be what makes a second record "different".
        EmployeeCode = Guard.AgainstNullOrWhiteSpace(employeeCode, nameof(employeeCode)).Trim();
        FullName = Guard.AgainstNullOrWhiteSpace(fullName, nameof(fullName));
        JobTitle = jobTitle;
        // Stored canonically, by the same rule as a customer's and for the same reason: a missing
        // country code must not be what makes a second record for one person.
        PhoneNumber = IndianPhoneNumber.Normalize(
            Guard.AgainstNullOrWhiteSpace(phoneNumber, nameof(phoneNumber)));
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();

        if (LastWorkingDate is { } last && joiningDate > last)
        {
            throw new ArgumentException(
                $"Joining date {joiningDate:yyyy-MM-dd} is after the recorded last working date {last:yyyy-MM-dd}.",
                nameof(joiningDate));
        }

        JoiningDate = joiningDate;
        EmploymentType = employmentType;
    }
}
