using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Delete;

public sealed class DeleteClothPriceCommandHandler : ICommandHandler<DeleteClothPriceCommand, Result>
{
    private readonly IClothPriceRepository _clothPriceRepository;
    private readonly ICurrentUserService _currentUserService;

    public DeleteClothPriceCommandHandler(IClothPriceRepository clothPriceRepository, ICurrentUserService currentUserService)
    {
        _clothPriceRepository = clothPriceRepository;
        _currentUserService = currentUserService;
    }

    public async Task<Result> Handle(DeleteClothPriceCommand command, CancellationToken cancellationToken)
    {
        var clothPrice = await _clothPriceRepository.GetByIdAsync(command.Id, cancellationToken);
        if (clothPrice is null)
        {
            return Result.Failure(
                Error.NotFound("ClothPrice.NotFound", $"No price was found with id '{command.Id}'."));
        }

        // A price an order was cut from is not the shop's to remove. Deleting it is a soft delete,
        // so the row survives and nothing breaks at the database — but every screen reads through
        // the query filter, so the order would show a cloth code that no longer resolves to
        // anything, and the stock figures would stop counting what that order took out.
        //
        // Refused rather than cascaded: the shop's answer to "we do not sell this any more" is to
        // stop using the code, not to erase the orders that already did.
        if (await _clothPriceRepository.IsUsedOnAnyOrderAsync(command.Id, cancellationToken))
        {
            return Result.Failure(Error.Conflict(
                "ClothPrice.InUse",
                $"'{clothPrice.ClothCode}' is used on one or more orders and can't be deleted. Edit the price instead, or stop using the code on new orders."));
        }

        var deletedBy = _currentUserService.UserId ?? SystemUsers.SystemUserId;
        clothPrice.SoftDelete(deletedBy, DateTime.UtcNow);

        await _clothPriceRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
