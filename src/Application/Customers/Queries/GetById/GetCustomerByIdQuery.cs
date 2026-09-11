using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.GetById;

public sealed record GetCustomerByIdQuery(Guid Id) : IQuery<Result<CustomerDto>>;
