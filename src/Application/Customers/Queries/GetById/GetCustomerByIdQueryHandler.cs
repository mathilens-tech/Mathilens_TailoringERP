using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.GetById;

public sealed class GetCustomerByIdQueryHandler : IQueryHandler<GetCustomerByIdQuery, Result<CustomerDto>>
{
    private readonly ICustomerRepository _customerRepository;

    public GetCustomerByIdQueryHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<CustomerDto>> Handle(GetCustomerByIdQuery query, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(query.Id, cancellationToken);

        return customer is null
            ? Result.Failure<CustomerDto>(Error.NotFound("Customer.NotFound", $"No customer was found with id '{query.Id}'."))
            : customer.ToDto();
    }
}
