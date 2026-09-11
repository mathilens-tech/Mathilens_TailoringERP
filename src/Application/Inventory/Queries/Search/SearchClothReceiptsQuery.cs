using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Queries.Search;

/// <param name="Search">Free text over the cloth code, name, supplier and invoice number.</param>
/// <param name="ClothPriceId">Narrows to one cloth — "everything we received of this".</param>
public sealed record SearchClothReceiptsQuery(
    string? Search,
    Guid? ClothPriceId,
    DateOnly? FromDate,
    DateOnly? ToDate,
    int Page,
    int PageSize) : IQuery<Result<PagedResult<ClothReceiptDto>>>;
