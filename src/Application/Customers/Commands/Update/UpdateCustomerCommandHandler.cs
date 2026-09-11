using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Update;

public sealed class UpdateCustomerCommandHandler : ICommandHandler<UpdateCustomerCommand, Result<CustomerDto>>
{
    private readonly ICustomerRepository _customerRepository;

    public UpdateCustomerCommandHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<CustomerDto>> Handle(UpdateCustomerCommand command, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(command.Id, cancellationToken);
        if (customer is null)
        {
            return Result.Failure<CustomerDto>(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.Id}'."));
        }

        // Canonical form before comparing, for the reason given in CustomerUniqueness.
        var phoneNumber = IndianPhoneNumber.Normalize(command.PhoneNumber);

        // Same uniqueness rule as create — but the customer's own current details are not a clash.
        var conflict = await CustomerUniqueness.FindConflictAsync(
            _customerRepository, phoneNumber, command.Email, command.Id, cancellationToken);
        if (conflict is { } error)
        {
            return Result.Failure<CustomerDto>(error);
        }

        customer.UpdateDetails(
            command.FullName,
            phoneNumber,
            command.Email,
            command.Address,
            command.Notes,
            command.Gender,
            command.Religion,
            command.DateOfBirth,
            command.WeddingDate);
        await _customerRepository.SaveChangesAsync(cancellationToken);

        return customer.ToDto();
    }
}
