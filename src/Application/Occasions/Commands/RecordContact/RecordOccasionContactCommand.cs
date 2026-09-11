using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Occasions.Commands.RecordContact;

/// <summary>
/// Marks an occasion as followed up, or amends the remarks if it was already marked this year.
/// </summary>
public sealed record RecordOccasionContactCommand(
    Guid CustomerId,
    OccasionType Occasion,
    int OccasionYear,
    DateOnly ContactedOn,
    string? Remarks) : ICommand<Result>;
