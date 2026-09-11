using MathilensERP.Application.Settings;
using MathilensERP.Application.Settings.Queries.GetByKey;
using MathilensERP.Domain.Settings;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Settings.Queries.GetByKey;

public class GetSettingByKeyQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingSetting_ReturnsDto()
    {
        var setting = Setting.Create("Shop.BusinessName", "Mathilens Tailoring");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync("Shop.BusinessName", Arg.Any<CancellationToken>()).Returns(setting);
        var handler = new GetSettingByKeyQueryHandler(repository);

        var result = await handler.Handle(new GetSettingByKeyQuery("Shop.BusinessName"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Mathilens Tailoring", result.Value.Value);
    }

    [Fact]
    public async Task Handle_WithUnknownKey_ReturnsNotFound()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var handler = new GetSettingByKeyQueryHandler(repository);

        var result = await handler.Handle(new GetSettingByKeyQuery("Unknown.Key"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Setting.NotFound", result.Error.Code);
    }
}
