using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.Login;

/// <param name="UserName">
/// What the account signs in as, not its email address. Accounts created before usernames were
/// asked for have their email in this field — Identity has always stored one here — so they sign in
/// exactly as they did before, by typing that address.
/// </param>
public sealed record LoginCommand(string UserName, string Password) : ICommand<Result<AuthTokensDto>>;
