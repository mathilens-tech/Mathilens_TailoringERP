using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Queries.GetByKey;

public sealed class GetSettingByKeyQueryHandler : IQueryHandler<GetSettingByKeyQuery, Result<SettingDto>>
{
    private readonly ISettingRepository _settingRepository;

    public GetSettingByKeyQueryHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<SettingDto>> Handle(GetSettingByKeyQuery query, CancellationToken cancellationToken)
    {
        var setting = await _settingRepository.GetByKeyAsync(query.Key, cancellationToken);

        return setting is null
            ? Result.Failure<SettingDto>(Error.NotFound("Setting.NotFound", $"No setting was found with key '{query.Key}'."))
            : setting.ToDto();
    }
}
