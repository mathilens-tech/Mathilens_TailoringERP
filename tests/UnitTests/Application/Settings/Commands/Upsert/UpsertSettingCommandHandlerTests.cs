using MathilensERP.Application.Settings;
using MathilensERP.Application.Settings.Commands.Upsert;
using MathilensERP.Domain.Settings;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Settings.Commands.Upsert;

public class UpsertSettingCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithNewKey_CreatesSetting()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync("Shop.BusinessName", Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var handler = new UpsertSettingCommandHandler(repository);

        var result = await handler.Handle(new UpsertSettingCommand("Shop.BusinessName", "Mathilens Tailoring"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Shop.BusinessName", result.Value.Key);
        Assert.Equal("Mathilens Tailoring", result.Value.Value);
        repository.Received(1).Add(Arg.Any<Setting>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithExistingKey_UpdatesValueWithoutAdding()
    {
        var existing = Setting.Create("Shop.BusinessName", "Old Name");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync("Shop.BusinessName", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new UpsertSettingCommandHandler(repository);

        var result = await handler.Handle(new UpsertSettingCommand("Shop.BusinessName", "New Name"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Name", result.Value.Value);
        repository.DidNotReceive().Add(Arg.Any<Setting>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
