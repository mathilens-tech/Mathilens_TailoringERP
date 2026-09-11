namespace MathilensERP.Application.Settings;

public sealed record SettingDto(Guid Id, string Key, string Value, DateTime CreatedAtUtc, DateTime? LastModifiedAtUtc);
