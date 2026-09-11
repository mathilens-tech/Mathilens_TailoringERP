namespace MathilensERP.Shared.Results;

/// <summary>
/// A stable, machine-readable failure reason carried by a <see cref="Result"/>.
/// Mirrors the "code" / "message" / "details" shape in the API error model (00_MASTER_SPEC.md § 8.7).
/// </summary>
public sealed record Error(string Code, string Message, ErrorType Type, IReadOnlyList<FieldError>? Details = null)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Failure);

    public static Error Failure(string code, string message) => new(code, message, ErrorType.Failure);

    public static Error Validation(string code, string message, IReadOnlyList<FieldError>? details = null) =>
        new(code, message, ErrorType.Validation, details);

    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);

    public static Error Conflict(string code, string message) => new(code, message, ErrorType.Conflict);

    public static Error Unauthorized(string code, string message) => new(code, message, ErrorType.Unauthorized);

    public static Error Forbidden(string code, string message) => new(code, message, ErrorType.Forbidden);
}
