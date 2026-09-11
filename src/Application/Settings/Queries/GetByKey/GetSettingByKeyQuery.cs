using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Queries.GetByKey;

public sealed record GetSettingByKeyQuery(string Key) : IQuery<Result<SettingDto>>;
