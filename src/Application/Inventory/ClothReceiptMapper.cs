using MathilensERP.Domain.Inventory;

namespace MathilensERP.Application.Inventory;

internal static class ClothReceiptMapper
{
    public static ClothReceiptDto ToDto(this ClothReceipt receipt) =>
        new(
            receipt.Id,
            receipt.ClothPriceId,
            receipt.ClothCode,
            receipt.ClothName,
            receipt.Quantity,
            receipt.Unit,
            receipt.ReceivedOn,
            receipt.SupplierName,
            receipt.InvoiceNumber,
            receipt.RatePerUnit,
            receipt.TotalCost,
            receipt.Notes,
            receipt.CreatedAtUtc);
}
