using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Settings.Commands.Delete;

public sealed class DeleteSettingCommandHandler : ICommandHandler<DeleteSettingCommand, Result>
{
    private readonly ISettingRepository _settingRepository;

    public DeleteSettingCommandHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result> Handle(DeleteSettingCommand command, CancellationToken cancellationToken)
    {
        var setting = await _settingRepository.GetByKeyAsync(command.Key, cancellationToken);
        if (setting is null)
        {
            return Result.Failure(Error.NotFound("Setting.NotFound", $"No setting was found with key '{command.Key}'."));
        }

        _settingRepository.Remove(setting);
        await _settingRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
