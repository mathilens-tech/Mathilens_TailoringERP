using MathilensERP.Domain.Customers;

namespace MathilensERP.Application.Customers;

public sealed record CustomerDto(
    Guid Id,
    string FullName,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Notes,
    Gender? Gender,
    Religion? Religion,
    DateOnly? DateOfBirth,
    DateOnly? WeddingDate,
    DateTime CreatedAtUtc);
