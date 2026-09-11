using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.ListAll;

/// <summary>Every customer, unpaginated — backs the spreadsheet export.</summary>
public sealed record ListAllCustomersQuery : IQuery<Result<IReadOnlyList<CustomerDto>>>;
