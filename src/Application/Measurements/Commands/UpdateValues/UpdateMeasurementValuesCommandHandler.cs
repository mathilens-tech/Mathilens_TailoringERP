using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Commands.UpdateValues;

/// <summary>
/// Updating a <see cref="Measurement"/> never overwrites history in place — the current
/// values are snapshotted into a new <see cref="MeasurementHistory"/> row first, per
/// 02_DATABASE.md § 10.4 Retention Rules.
/// </summary>
public sealed class UpdateMeasurementValuesCommandHandler : ICommandHandler<UpdateMeasurementValuesCommand, Result<MeasurementDto>>
{
    private readonly IMeasurementRepository _measurementRepository;

    public UpdateMeasurementValuesCommandHandler(IMeasurementRepository measurementRepository)
    {
        _measurementRepository = measurementRepository;
    }

    public async Task<Result<MeasurementDto>> Handle(UpdateMeasurementValuesCommand command, CancellationToken cancellationToken)
    {
        var measurement = await _measurementRepository.GetByIdAsync(command.Id, cancellationToken);
        if (measurement is null)
        {
            return Result.Failure<MeasurementDto>(
                Error.NotFound("Measurement.NotFound", $"No measurement was found with id '{command.Id}'."));
        }

        var snapshot = MeasurementHistory.CaptureSnapshot(measurement);
        _measurementRepository.AddHistory(snapshot);

        measurement.UpdateValues(command.Values);
        measurement.UpdateNotes(command.Notes);

        await _measurementRepository.SaveChangesAsync(cancellationToken);

        return measurement.ToDto();
    }
}
