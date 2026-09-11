using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Import;

public sealed record ImportClothPricesCommand(IReadOnlyList<ClothPriceImportRow> Rows) : ICommand<Result<ImportResultDto>>;

/// <param name="RowNumber">The row's position in the uploaded sheet, so failures can be reported where the operator can find them.</param>
/// <param name="Id">Set when the row came from an export round-trip; matched ahead of <paramref name="ClothCode"/>.</param>
public sealed record ClothPriceImportRow(
    int RowNumber,
    Guid? Id,
    string ClothCode,
    string ClothName,
    decimal CostPrice,
    decimal SellingPrice);
