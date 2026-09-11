using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Auth;
using MathilensERP.Application.Auth.Commands.RedeemResetCode;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Auth.Commands.Login;
using MathilensERP.Application.Auth.Commands.RefreshAccessToken;
using MathilensERP.Application.Auth.Commands.Register;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Authentication endpoints (00_MASTER_SPEC.md § 10.1). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/auth")]
[AllowAnonymous]
public sealed class AuthController : ApiControllerBase
{
    private readonly ISender _sender;

    public AuthController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Authenticates a user and issues a JWT access token + refresh token pair.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<AuthTokensDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new LoginCommand(request.UserName, request.Password), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Creates a new account and signs them straight in, issuing a JWT access token + refresh token pair.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<AuthTokensDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RegisterCommand(request.Email, request.Password), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Redeems the one-time code an Owner issued, letting the user choose their own password.
    ///
    /// Deliberately unauthenticated — the caller cannot sign in, which is why they were given a
    /// code. The code is what stands in for authentication, so it is single-use, expires, and every
    /// way of failing returns the same message: this endpoint must not become a way to discover
    /// which email addresses have accounts.
    /// </summary>
    [HttpPost("redeem-reset-code")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RedeemResetCode([FromBody] RedeemResetCodeRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new RedeemResetCodeCommand(request.Email, request.Code, request.NewPassword),
            cancellationToken);

        return ToActionResult(result);
    }

    /// <summary>Redeems a refresh token for a new token pair, rotating the presented token.</summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(ApiResponse<AuthTokensDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RefreshAccessTokenCommand(request.RefreshToken), cancellationToken);
        return ToActionResult(result);
    }
}
