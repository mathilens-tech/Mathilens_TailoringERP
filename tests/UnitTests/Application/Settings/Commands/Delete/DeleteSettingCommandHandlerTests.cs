using MathilensERP.Application.Settings;
using MathilensERP.Application.Settings.Commands.Delete;
using MathilensERP.Domain.Settings;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Settings.Commands.Delete;

public class DeleteSettingCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingSetting_RemovesAndSaves()
    {
        var setting = Setting.Create("Shop.BusinessName", "Mathilens Tailoring");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync("Shop.BusinessName", Arg.Any<CancellationToken>()).Returns(setting);
        var handler = new DeleteSettingCommandHandler(repository);

        var result = await handler.Handle(new DeleteSettingCommand("Shop.BusinessName"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        repository.Received(1).Remove(setting);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownKey_ReturnsNotFound()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var handler = new DeleteSettingCommandHandler(repository);

        var result = await handler.Handle(new DeleteSettingCommand("Unknown.Key"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Setting.NotFound", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
