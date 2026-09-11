using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.ChangePassword;

/// <summary>Changing your own password. Both properties are redacted from the activity trail by name.</summary>
public sealed record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword)
    : ICommand<Result<AuthTokensDto>>;
