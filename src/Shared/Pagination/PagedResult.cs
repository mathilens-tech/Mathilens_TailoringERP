namespace MathilensERP.Shared.Pagination;

/// <summary>
/// A single page of results plus the metadata needed to render pagination
/// (00_MASTER_SPEC.md § 8.3) — the shape every collection-returning query returns.
/// </summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}
