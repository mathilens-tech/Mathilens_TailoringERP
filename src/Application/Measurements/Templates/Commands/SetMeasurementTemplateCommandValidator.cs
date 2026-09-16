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
            .WithMessage("A measurement point must take a number, a checkbox or text.")
            // Both ends or neither. One end alone cannot lay out an entry pad, and storing it would
            // leave a template that looks configured and behaves as though it is not.
            .Must(point => point.Min.HasValue == point.Max.HasValue)
            .WithMessage("A measurement range needs both a lowest and a highest value, or neither.")
            .Must(point => point.Min is not { } min || point.Max is not { } max || max > min)
            .WithMessage("A measurement range's highest value must be above its lowest.")
            // A range belongs to a figure. A tick has two answers and a word has no order, so
            // bounds on either would be stored and never read — silently meaningless configuration.
            .Must(point => point.Type == MeasurementPointType.Number || (point.Min is null && point.Max is null))
            .WithMessage("Only a number point can have a range.")
            .Must(point => point.SecondName is null || point.SecondName.Length <= MaxPointNameLength)
            .WithMessage($"A second box's label can be at most {MaxPointNameLength} characters.")
            // Same reasoning as the range: a tick and a word have one answer each, so a second box
            // on either would be stored and never rendered.
            .Must(point => point.Type == MeasurementPointType.Number || string.IsNullOrWhiteSpace(point.SecondName))
            .WithMessage("Only a number point can have a second box.")
            // The two boxes are told apart by their labels on screen and in the saved values, so
            // two boxes under one name is the same collision two points under one name would be.
            .Must(point => string.IsNullOrWhiteSpace(point.SecondName)
                || !string.Equals(point.SecondName.Trim(), point.Name?.Trim(), StringComparison.OrdinalIgnoreCase))
            .WithMessage("A point's two boxes must have different labels.");

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
