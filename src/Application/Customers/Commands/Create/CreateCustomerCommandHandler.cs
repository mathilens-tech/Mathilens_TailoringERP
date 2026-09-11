using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Create;

public sealed class CreateCustomerCommandHandler : ICommandHandler<CreateCustomerCommand, Result<CustomerDto>>
{
    private readonly ICustomerRepository _customerRepository;

    public CreateCustomerCommandHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<CustomerDto>> Handle(CreateCustomerCommand command, CancellationToken cancellationToken)
    {
        // Canonical form before anything compares it — see CustomerUniqueness for why.
        var phoneNumber = IndianPhoneNumber.Normalize(command.PhoneNumber);

        var conflict = await CustomerUniqueness.FindConflictAsync(
            _customerRepository, phoneNumber, command.Email, excludeId: null, cancellationToken);
        if (conflict is { } error)
        {
            return Result.Failure<CustomerDto>(error);
        }

        var customer = Customer.Create(
            command.FullName,
            phoneNumber,
            command.Email,
            command.Address,
            command.Notes,
            command.Gender,
            command.Religion,
            command.DateOfBirth,
            command.WeddingDate);

        _customerRepository.Add(customer);
        await _customerRepository.SaveChangesAsync(cancellationToken);

        return customer.ToDto();
    }
}
