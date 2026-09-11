using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Commands.Delete;

public sealed record DeleteSettingCommand(string Key) : ICommand<Result>;
