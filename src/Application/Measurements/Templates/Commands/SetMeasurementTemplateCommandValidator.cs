using MathilensERP.Domain.Measurements;
using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Measurements.Templates.Commands;

public sealed class SetMeasurementTemplateCommandValidator : AbstractValidator<SetMeasurementTemplateCommand>
{
    /// <summary>Keeps the serialized JSON comfortably inside the Settings value column's 4000 characters.</summary>
    private const int MaxPoints = 60;

    /// <summary>Matched to what the old MaximumLength rule allowed, so nothing a shop already saved becomes invalid.</summary>
    private const int MaxPointNameLength = 60;

    public SetMeasurementTemplateCommandValidator()
    {
        RuleFor(x => x.GarmentType)
            .MustBeAGarmentName();

        RuleFor(x => x.Points)
            .NotEmpty()
            .WithMessage("A garment type needs at least one measurement point.")
            .Must(points => points.Count <= MaxPoints)
            .WithMessage($"A garment type can have at most {MaxPoints} measurement points.");

        RuleForEach(x => x.Points)
            .Must(point => !string.IsNullOrWhiteSpace(point.Name))
            .WithMessage("A measurement point name cannot be blank.")
            .Must(point => point.Name.Length <= MaxPointNameLength)
            .WithMessage($"A measurement point name can be at most {MaxPointNameLength} characters.")
            .Must(point => Enum.IsDefined(point.Type))
            .WithMessage("A measurement point must take a number, a checkbox or text.");

        // Values are stored keyed by point name, so two points sharing a name would silently
        // collapse into one on save.
        RuleFor(x => x.Points)
            .Must(points => points
                .Select(p => p.Name?.Trim() ?? string.Empty)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() == points.Count)
            .WithMessage("Each measurement point must have a distinct name.")
            .When(x => x.Points is { Count: > 0 });
    }
}
