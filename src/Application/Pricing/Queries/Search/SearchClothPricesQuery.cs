using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.Search;

/// <summary>Free-text search over <c>ClothCode</c> (00_MASTER_SPEC.md § 8.4 Filtering) — powers both the Price Detail page and the New Order Cloth code picker.</summary>
public sealed record SearchClothPricesQuery(string? SearchTerm, int Page, int PageSize) : IQuery<Result<PagedResult<ClothPriceDto>>>;
