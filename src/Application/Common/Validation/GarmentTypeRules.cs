using FluentValidation;
using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Common.Validation;

/// <summary>
/// The one place a garment name is checked, so an order, a measurement and a template all agree on
/// what one may be.
///
/// This replaced <c>IsInEnum()</c>. The old rule answered "is this one of eight values the system
/// shipped with", which is not the question — the garments a shop stitches are its own, and the
/// list is configuration. What is left is what actually has to hold for the value to be storable
/// and readable: present, inside the column, and free of control characters.
/// </summary>
public static class GarmentTypeRules
{
    public static IRuleBuilderOptions<T, string> MustBeAGarmentName<T>(this IRuleBuilder<T, string> rule) =>
        rule
            .NotEmpty()
            .WithMessage("Garment type is required.")
            .MaximumLength(GarmentTypes.MaxLength)
            .Must(GarmentTypes.IsWellFormed)
            .WithMessage("Garment type must be a name, up to " + GarmentTypes.MaxLength + " characters.");
}
