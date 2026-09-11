namespace MathilensERP.Domain.Employees;

/// <summary>
/// How a staff member is engaged. A fixed set rather than free text: the shop distinguishes these
/// two for pay and for who may be assigned long-running work, and a typo'd third value would make
/// both questions unanswerable.
/// </summary>
public enum EmploymentType
{
    FullTime,
    Contract
}
