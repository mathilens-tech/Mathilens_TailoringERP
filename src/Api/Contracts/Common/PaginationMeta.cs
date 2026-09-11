using MathilensERP.Shared.Pagination;

namespace MathilensERP.Api.Contracts.Common;

/// <summary>The <c>meta</c> object for a paginated collection response (00_MASTER_SPEC.md § 8.3).</summary>
public sealed record PaginationMeta(int Page, int PageSize, int TotalCount, int TotalPages)
{
    public static PaginationMeta From<T>(PagedResult<T> page) => new(page.Page, page.PageSize, page.TotalCount, page.TotalPages);
}
