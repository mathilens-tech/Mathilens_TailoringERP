using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Commands.Receive;

/// <summary>
/// Records a delivery of cloth. The cloth is chosen from the price list, so the code and name on
/// the receipt come from the catalogue rather than being typed — two spellings of the same cloth
/// would never reconcile against a supplier bill.
/// </summary>
public sealed record ReceiveClothCommand(
    Guid ClothPriceId,
    decimal Quantity,
    ClothUnit Unit,
    DateOnly ReceivedOn,
    string? SupplierName,
    string? InvoiceNumber,
    decimal? RatePerUnit,
    string? Notes) : ICommand<Result<ClothReceiptDto>>;
