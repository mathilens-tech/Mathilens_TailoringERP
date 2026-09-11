using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.ListAll;

public sealed class ListAllCustomersQueryHandler : IQueryHandler<ListAllCustomersQuery, Result<IReadOnlyList<CustomerDto>>>
{
    private readonly ICustomerRepository _customerRepository;

    public ListAllCustomersQueryHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<IReadOnlyList<CustomerDto>>> Handle(ListAllCustomersQuery query, CancellationToken cancellationToken)
    {
        var customers = await _customerRepository.ListAllAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CustomerDto>>(customers.Select(c => c.ToDto()).ToList());
    }
}
