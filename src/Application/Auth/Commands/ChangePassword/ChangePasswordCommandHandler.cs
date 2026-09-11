using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.ChangePassword;

public sealed class ChangePasswordCommandHandler : ICommandHandler<ChangePasswordCommand, Result<AuthTokensDto>>
{
    private readonly IIdentityService _identityService;

    public ChangePasswordCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public Task<Result<AuthTokensDto>> Handle(ChangePasswordCommand command, CancellationToken cancellationToken) =>
        _identityService.ChangePasswordAsync(command.UserId, command.CurrentPassword, command.NewPassword, cancellationToken);
}
