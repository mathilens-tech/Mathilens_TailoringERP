using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.RefreshAccessToken;

public sealed class RefreshAccessTokenCommandHandler : ICommandHandler<RefreshAccessTokenCommand, Result<AuthTokensDto>>
{
    private readonly IIdentityService _identityService;

    public RefreshAccessTokenCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public Task<Result<AuthTokensDto>> Handle(RefreshAccessTokenCommand command, CancellationToken cancellationToken) =>
        _identityService.RefreshTokenAsync(command.RefreshToken, cancellationToken);
}
