using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Create;

public sealed record CreateCustomerCommand(
    string FullName,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Notes,
    Gender? Gender = null,
    Religion? Religion = null,
    DateOnly? DateOfBirth = null,
    DateOnly? WeddingDate = null) : ICommand<Result<CustomerDto>>;
