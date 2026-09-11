using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Auth.Commands.Register;

public sealed record RegisterCommand(string Email, string Password) : ICommand<Result<AuthTokensDto>>;
