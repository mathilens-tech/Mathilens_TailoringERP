using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.Login;

/// <summary>
/// Thin orchestration by design: credential verification, password hashing, and lockout
/// are already correctly handled by ASP.NET Core Identity behind <see cref="IIdentityService"/>
/// (00_MASTER_SPEC.md § 5 Technology Stack) — there is no additional business rule to enforce here.
/// </summary>
public sealed class LoginCommandHandler : ICommandHandler<LoginCommand, Result<AuthTokensDto>>
{
    private readonly IIdentityService _identityService;

    public LoginCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public Task<Result<AuthTokensDto>> Handle(LoginCommand command, CancellationToken cancellationToken) =>
        _identityService.LoginAsync(command.UserName, command.Password, cancellationToken);
}
