using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.RedeemResetCode;

/// <summary>
/// Redeems the one-time code an Owner handed over, setting the password the user chose.
///
/// The property is <c>ResetCode</c> rather than <c>Code</c> so the activity trail redacts it: the
/// builder matches on name fragments, and a bare "code" would also blank out EmployeeCode and
/// ClothCode, which are exactly the kind of detail an audit entry is worth reading for.
/// </summary>
public sealed record RedeemResetCodeCommand(string Email, string ResetCode, string NewPassword) : ICommand<Result>;
