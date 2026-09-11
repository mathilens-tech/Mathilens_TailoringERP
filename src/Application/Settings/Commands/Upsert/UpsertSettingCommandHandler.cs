using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Commands.Upsert;

public sealed class UpsertSettingCommandHandler : ICommandHandler<UpsertSettingCommand, Result<SettingDto>>
{
    private readonly ISettingRepository _settingRepository;

    public UpsertSettingCommandHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<SettingDto>> Handle(UpsertSettingCommand command, CancellationToken cancellationToken)
    {
        var setting = await _settingRepository.GetByKeyAsync(command.Key, cancellationToken);

        if (setting is null)
        {
            setting = Setting.Create(command.Key, command.Value);
            _settingRepository.Add(setting);
        }
        else
        {
            setting.UpdateValue(command.Value);
        }

        await _settingRepository.SaveChangesAsync(cancellationToken);

        return setting.ToDto();
    }
}
