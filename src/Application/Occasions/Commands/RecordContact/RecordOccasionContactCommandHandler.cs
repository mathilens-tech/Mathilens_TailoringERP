using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Occasions.Commands.RecordContact;

public sealed class RecordOccasionContactCommandHandler : ICommandHandler<RecordOccasionContactCommand, Result>
{
    private readonly IOccasionRepository _occasions;

    public RecordOccasionContactCommandHandler(IOccasionRepository occasions)
    {
        _occasions = occasions;
    }

    public async Task<Result> Handle(RecordOccasionContactCommand command, CancellationToken cancellationToken)
    {
        await _occasions.UpsertContactAsync(
            new RecordOccasionContactDto(
                command.CustomerId,
                command.Occasion,
                command.OccasionYear,
                command.ContactedOn,
                command.Remarks),
            cancellationToken);

        return Result.Success();
    }
}
