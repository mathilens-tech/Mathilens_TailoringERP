namespace MathilensERP.Api.Contracts.Auth;

/// <summary>
/// Redeeming the one-time code an Owner handed over, and choosing a password with it.
///
/// Unauthenticated: the caller cannot sign in, which is the whole reason they were given a code.
/// The code is what stands in for authentication here.
/// </summary>
public sealed record RedeemResetCodeRequest(string Email, string Code, string NewPassword);
