using MathilensERP.Domain.Measurements;
using FluentValidation;

namespace MathilensERP.Application.Measurements.Commands.UpdateValues;

public sealed class UpdateMeasurementValuesCommandValidator : AbstractValidator<UpdateMeasurementValuesCommand>
{
    public UpdateMeasurementValuesCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.Values)
            .NotEmpty()
            .WithMessage("At least one measurement value is required.");

        RuleForEach(x => x.Values)
            .Must(point => !string.IsNullOrWhiteSpace(point.Key))
            .WithMessage("Measurement point names cannot be blank.")
            // Only figures have to be positive. "No side pocket" and an empty style are answers,
            // not missing data, so the old blanket rule would have refused both.
            .Must(point => point.Value.Kind != MeasurementPointType.Number || point.Value.Number > 0)
            .WithMessage("Measurement values must be greater than zero.");
    }
}
