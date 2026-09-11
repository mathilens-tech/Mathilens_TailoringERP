using MathilensERP.Domain.Measurements;
using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Measurements.Commands.Create;

public sealed class CreateMeasurementCommandValidator : AbstractValidator<CreateMeasurementCommand>
{
    public CreateMeasurementCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty();

        RuleFor(x => x.GarmentType)
            .MustBeAGarmentName();

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
