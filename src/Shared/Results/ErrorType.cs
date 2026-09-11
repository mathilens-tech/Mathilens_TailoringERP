namespace MathilensERP.Shared.Results;

/// <summary>
/// Categorizes an <see cref="Error"/> so the Api layer can map it to the correct
/// HTTP status code (00_MASTER_SPEC.md § 8.3) without Application/Domain knowing about HTTP.
/// </summary>
public enum ErrorType
{
    Failure,
    Validation,
    NotFound,
    Conflict,
    Unauthorized,
    Forbidden
}
