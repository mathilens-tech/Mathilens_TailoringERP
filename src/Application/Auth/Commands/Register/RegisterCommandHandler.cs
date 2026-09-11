using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.Register;

/// <summary>
/// Thin orchestration by design, matching <see cref="MathilensERP.Application.Auth.Commands.Login.LoginCommandHandler"/>:
/// account creation, uniqueness, and password hashing are already correctly handled by
/// ASP.NET Core Identity behind <see cref="IIdentityService"/>.
/// </summary>
public sealed class RegisterCommandHandler : ICommandHandler<RegisterCommand, Result<AuthTokensDto>>
{
    private readonly IIdentityService _identityService;

    public RegisterCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public Task<Result<AuthTokensDto>> Handle(RegisterCommand command, CancellationToken cancellationToken) =>
        _identityService.RegisterAsync(command.Email, command.Password, cancellationToken);
}
