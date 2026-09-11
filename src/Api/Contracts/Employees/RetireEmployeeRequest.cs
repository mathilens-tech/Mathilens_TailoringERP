namespace MathilensERP.Api.Contracts.Employees;

/// <param name="LastWorkingDate">Their final day. Null puts them back on the active roster.</param>
public sealed record RetireEmployeeRequest(DateOnly? LastWorkingDate);
