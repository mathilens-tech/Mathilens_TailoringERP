using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Update;

public sealed record UpdateCustomerCommand(
    Guid Id,
    string FullName,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Notes,
    Gender? Gender = null,
    Religion? Religion = null,
    DateOnly? DateOfBirth = null,
    DateOnly? WeddingDate = null) : ICommand<Result<CustomerDto>>;
