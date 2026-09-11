using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Commands;

public sealed class ResetMeasurementTemplateCommandHandler
    : ICommandHandler<ResetMeasurementTemplateCommand, Result<MeasurementTemplateDto>>
{
    private readonly ISettingRepository _settingRepository;

    public ResetMeasurementTemplateCommandHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<MeasurementTemplateDto>> Handle(
        ResetMeasurementTemplateCommand command,
        CancellationToken cancellationToken)
    {
        var setting = await _settingRepository.GetByKeyAsync(MeasurementTemplateKeys.For(command.GarmentType), cancellationToken);

        // Already on the default — resetting again is the same outcome, not an error.
        if (setting is not null)
        {
            _settingRepository.Remove(setting);
            await _settingRepository.SaveChangesAsync(cancellationToken);
        }

        return new MeasurementTemplateDto(
            command.GarmentType,
            MeasurementTemplateDefaults.For(command.GarmentType),
            IsCustomised: false);
    }
}
