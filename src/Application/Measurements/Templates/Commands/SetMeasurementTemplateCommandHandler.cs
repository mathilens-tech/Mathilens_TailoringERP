using System.Text.Json;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Commands;

public sealed class SetMeasurementTemplateCommandHandler
    : ICommandHandler<SetMeasurementTemplateCommand, Result<MeasurementTemplateDto>>
{
    private readonly ISettingRepository _settingRepository;

    public SetMeasurementTemplateCommandHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<MeasurementTemplateDto>> Handle(
        SetMeasurementTemplateCommand command,
        CancellationToken cancellationToken)
    {
        var points = command.Points.Select(p => p with { Name = p.Name.Trim() }).ToList();
        var key = MeasurementTemplateKeys.For(command.GarmentType);
        var json = JsonSerializer.Serialize(points);

        var setting = await _settingRepository.GetByKeyAsync(key, cancellationToken);
        if (setting is null)
        {
            setting = Setting.Create(key, json);
            _settingRepository.Add(setting);
        }
        else
        {
            setting.UpdateValue(json);
        }

        await _settingRepository.SaveChangesAsync(cancellationToken);

        return new MeasurementTemplateDto(command.GarmentType, points, IsCustomised: true);
    }
}
