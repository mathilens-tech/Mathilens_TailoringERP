using MathilensERP.Domain.Settings;

namespace MathilensERP.Application.Settings;

internal static class SettingMapper
{
    public static SettingDto ToDto(this Setting setting) =>
        new(setting.Id, setting.Key, setting.Value, setting.CreatedAtUtc, setting.LastModifiedAtUtc);
}
