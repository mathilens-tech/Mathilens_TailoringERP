using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Commands.Receive;

public sealed class ReceiveClothCommandHandler : ICommandHandler<ReceiveClothCommand, Result<ClothReceiptDto>>
{
    private readonly IClothReceiptRepository _receiptRepository;
    private readonly IClothPriceRepository _clothPriceRepository;

    public ReceiveClothCommandHandler(
        IClothReceiptRepository receiptRepository,
        IClothPriceRepository clothPriceRepository)
    {
        _receiptRepository = receiptRepository;
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<ClothReceiptDto>> Handle(ReceiveClothCommand command, CancellationToken cancellationToken)
    {
        // The catalogue entry is read here, not trusted from the request: the code and name are
        // copied onto the receipt, so they have to be the shop's, not whatever a caller sent.
        var clothPrice = await _clothPriceRepository.GetByIdAsync(command.ClothPriceId, cancellationToken);
        if (clothPrice is null)
        {
            return Result.Failure<ClothReceiptDto>(Error.NotFound(
                "ClothPrice.NotFound", $"No cloth was found with id '{command.ClothPriceId}'."));
        }

        var receipt = ClothReceipt.Create(
            clothPrice.Id,
            clothPrice.ClothCode,
            clothPrice.ClothName,
            command.Quantity,
            command.Unit,
            command.ReceivedOn,
            command.SupplierName,
            command.InvoiceNumber,
            command.RatePerUnit,
            command.Notes);

        _receiptRepository.Add(receipt);
        await _receiptRepository.SaveChangesAsync(cancellationToken);

        return receipt.ToDto();
    }
}
