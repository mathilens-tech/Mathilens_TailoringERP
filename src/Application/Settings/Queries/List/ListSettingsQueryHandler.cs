using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Queries.List;

public sealed class ListSettingsQueryHandler : IQueryHandler<ListSettingsQuery, Result<PagedResult<SettingDto>>>
{
    private readonly ISettingRepository _settingRepository;

    public ListSettingsQueryHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<PagedResult<SettingDto>>> Handle(ListSettingsQuery query, CancellationToken cancellationToken)
    {
        var page = await _settingRepository.ListAsync(query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(s => s.ToDto()).ToList();

        return new PagedResult<SettingDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
