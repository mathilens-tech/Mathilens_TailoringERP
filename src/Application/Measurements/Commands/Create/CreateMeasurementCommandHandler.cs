using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Measurements;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Commands.Create;

public sealed class CreateMeasurementCommandHandler : ICommandHandler<CreateMeasurementCommand, Result<MeasurementDto>>
{
    private readonly IMeasurementRepository _measurementRepository;
    private readonly ICustomerRepository _customerRepository;

    public CreateMeasurementCommandHandler(IMeasurementRepository measurementRepository, ICustomerRepository customerRepository)
    {
        _measurementRepository = measurementRepository;
        _customerRepository = customerRepository;
    }

    public async Task<Result<MeasurementDto>> Handle(CreateMeasurementCommand command, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(command.CustomerId, cancellationToken);
        if (customer is null)
        {
            return Result.Failure<MeasurementDto>(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.CustomerId}'."));
        }

        var alreadyExists = await _measurementRepository.ExistsForCustomerAndGarmentTypeAsync(command.CustomerId, command.GarmentType, cancellationToken);
        if (alreadyExists)
        {
            return Result.Failure<MeasurementDto>(Error.Conflict(
                "Measurement.AlreadyExists",
                $"Measurements for garment type '{command.GarmentType}' already exist for this customer — use update instead."));
        }

        var measurement = Measurement.Create(command.CustomerId, command.GarmentType, command.Values, command.Notes);

        _measurementRepository.Add(measurement);
        await _measurementRepository.SaveChangesAsync(cancellationToken);

        return measurement.ToDto();
    }
}
