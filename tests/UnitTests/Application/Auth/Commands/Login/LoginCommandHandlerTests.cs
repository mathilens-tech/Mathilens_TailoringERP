using MathilensERP.Application.Auth.Commands.Login;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Results;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Auth.Commands.Login;

public class LoginCommandHandlerTests
{
    [Fact]
    public async Task Handle_DelegatesToIdentityServiceWithCommandCredentials()
    {
        var identityService = Substitute.For<IIdentityService>();
        var expectedTokens = new AuthTokensDto("access-token", "refresh-token", DateTime.UtcNow.AddMinutes(15));
        identityService
            .LoginAsync("radha_owner", "s3cret!", Arg.Any<CancellationToken>())
            .Returns(Result.Success(expectedTokens));

        var handler = new LoginCommandHandler(identityService);

        var result = await handler.Handle(new LoginCommand("radha_owner", "s3cret!"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(expectedTokens, result.Value);
        await identityService.Received(1).LoginAsync("radha_owner", "s3cret!", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenIdentityServiceFails_PropagatesFailure()
    {
        var identityService = Substitute.For<IIdentityService>();
        var error = Error.Unauthorized("Auth.InvalidCredentials", "Invalid username or password.");
        identityService
            .LoginAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result.Failure<AuthTokensDto>(error));

        var handler = new LoginCommandHandler(identityService);

        var result = await handler.Handle(new LoginCommand("radha_owner", "wrong"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(error, result.Error);
    }
}
