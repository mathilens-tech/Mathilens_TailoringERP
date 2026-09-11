using MathilensERP.Application.Auth.Commands.RefreshAccessToken;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Results;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Auth.Commands.RefreshAccessToken;

public class RefreshAccessTokenCommandHandlerTests
{
    [Fact]
    public async Task Handle_DelegatesToIdentityServiceWithPresentedToken()
    {
        var identityService = Substitute.For<IIdentityService>();
        var expectedTokens = new AuthTokensDto("new-access-token", "new-refresh-token", DateTime.UtcNow.AddMinutes(15));
        identityService
            .RefreshTokenAsync("old-refresh-token", Arg.Any<CancellationToken>())
            .Returns(Result.Success(expectedTokens));

        var handler = new RefreshAccessTokenCommandHandler(identityService);

        var result = await handler.Handle(new RefreshAccessTokenCommand("old-refresh-token"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(expectedTokens, result.Value);
        await identityService.Received(1).RefreshTokenAsync("old-refresh-token", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenTokenReuseDetected_PropagatesFailure()
    {
        var identityService = Substitute.For<IIdentityService>();
        var error = Error.Unauthorized("Auth.TokenReuseDetected", "This refresh token has already been used. All sessions have been revoked.");
        identityService
            .RefreshTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result.Failure<AuthTokensDto>(error));

        var handler = new RefreshAccessTokenCommandHandler(identityService);

        var result = await handler.Handle(new RefreshAccessTokenCommand("reused-token"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(error, result.Error);
    }
}
