namespace MathilensERP.Shared.Constants;

/// <summary>
/// Solution-wide pagination bounds. Every collection endpoint is paginated by default
/// (00_MASTER_SPEC.md § 8.3) — these constants are the single source of truth for that
/// default/maximum so no module invents its own.
/// </summary>
public static class PaginationDefaults
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
}
