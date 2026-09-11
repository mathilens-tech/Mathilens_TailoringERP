namespace MathilensERP.Api.Contracts.Common;

/// <summary>Standard error envelope for every endpoint (00_MASTER_SPEC.md § 8.7).</summary>
public sealed record ApiErrorResponse(bool Success, ApiError Error)
{
    public static ApiErrorResponse From(string code, string message, IReadOnlyList<ApiFieldError>? details = null) =>
        new(false, new ApiError(code, message, details));
}

public sealed record ApiError(string Code, string Message, IReadOnlyList<ApiFieldError>? Details);

public sealed record ApiFieldError(string Field, string Message);
