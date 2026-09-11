using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Queries.List;

public sealed record ListSettingsQuery(int Page, int PageSize) : IQuery<Result<PagedResult<SettingDto>>>;
