using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.FindDuplicates;

public sealed class FindCustomerDuplicatesQueryHandler
    : IQueryHandler<FindCustomerDuplicatesQuery, Result<IReadOnlyList<CustomerDuplicateDto>>>
{
    private readonly ICustomerRepository _customerRepository;

    public FindCustomerDuplicatesQueryHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<IReadOnlyList<CustomerDuplicateDto>>> Handle(
        FindCustomerDuplicatesQuery query,
        CancellationToken cancellationToken)
    {
        // Normalized before comparing, so a number typed as "8220070363" is checked against the
        // "+918220070363" already in the table — the warning is worth nothing if it only fires
        // when the operator happens to type the same shape as the stored one.
        //
        // A number too malformed to normalize is dropped rather than compared raw: the field is
        // still being typed when this runs, and half a number matches nothing anyway.
        var phoneNumber = IndianPhoneNumber.TryNormalize(query.PhoneNumber, out var normalized) ? normalized : null;

        var matches = await _customerRepository.FindPotentialDuplicatesAsync(
            phoneNumber,
            query.Email,
            query.ExcludeId,
            cancellationToken);

        return Result.Success<IReadOnlyList<CustomerDuplicateDto>>(matches
            .Select(c => new CustomerDuplicateDto(
                c.Id,
                c.FullName,
                c.PhoneNumber,
                c.Email,
                phoneNumber is not null && c.PhoneNumber == phoneNumber,
                !string.IsNullOrWhiteSpace(query.Email)
                    && string.Equals(c.Email, query.Email.Trim(), StringComparison.OrdinalIgnoreCase)))
            .ToList());
    }
}
