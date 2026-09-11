namespace MathilensERP.Shared.Results;

/// <summary>
/// A single field-level validation failure, matching the "details" entries in the
/// API error model (00_MASTER_SPEC.md § 8.7).
/// </summary>
public sealed record FieldError(string Field, string Message);
