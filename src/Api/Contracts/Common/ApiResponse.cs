namespace MathilensERP.Api.Contracts.Common;

/// <summary>Standard success envelope for every endpoint (00_MASTER_SPEC.md § 8.6).</summary>
public sealed record ApiResponse<T>(bool Success, T Data, object? Meta = null)
{
    public static ApiResponse<T> Ok(T data, object? meta = null) => new(true, data, meta);
}
