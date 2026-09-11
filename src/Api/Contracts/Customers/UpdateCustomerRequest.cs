using MathilensERP.Domain.Customers;

namespace MathilensERP.Api.Contracts.Customers;

/// <summary>Gender, religion, date of birth and wedding date are all optional — existing customers were never asked for them.</summary>
public sealed record UpdateCustomerRequest(
    string FullName,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Notes,
    Gender? Gender = null,
    Religion? Religion = null,
    DateOnly? DateOfBirth = null,
    DateOnly? WeddingDate = null);
