using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.RefreshAccessToken;

/// <summary>
/// Kept out of the activity trail (<see cref="IUnloggedCommand"/>): the browser redeems a refresh
/// token on its own every time the 15-minute access token lapses, so logging it filled the trail
/// with several "Refresh Access Token" rows per user per hour that nobody performed. Sign-in and
/// registration stay logged — those are real events with a person behind them.
/// </summary>
public sealed record RefreshAccessTokenCommand(string RefreshToken) : ICommand<Result<AuthTokensDto>>, IUnloggedCommand;
