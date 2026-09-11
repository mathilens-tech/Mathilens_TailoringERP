using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Commands.Upsert;

/// <summary>Creates the setting if <c>Key</c> doesn't exist yet, otherwise updates its value — the natural operation for a key-value config store.</summary>
public sealed record UpsertSettingCommand(string Key, string Value) : ICommand<Result<SettingDto>>;
