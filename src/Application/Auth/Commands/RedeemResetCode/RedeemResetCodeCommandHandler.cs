using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.RedeemResetCode;

public sealed class RedeemResetCodeCommandHandler : ICommandHandler<RedeemResetCodeCommand, Result>
{
    private readonly IIdentityService _identityService;

    public RedeemResetCodeCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public Task<Result> Handle(RedeemResetCodeCommand command, CancellationToken cancellationToken) =>
        _identityService.RedeemResetCodeAsync(command.Email, command.ResetCode, command.NewPassword, cancellationToken);
}
