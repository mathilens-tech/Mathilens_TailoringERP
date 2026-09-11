using MathilensERP.Application.Settings;
using MathilensERP.Application.Settings.Queries.List;
using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Settings.Queries.List;

public class ListSettingsQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedSettingsToDtos()
    {
        var setting = Setting.Create("Shop.BusinessName", "Mathilens Tailoring");
        var repository = Substitute.For<ISettingRepository>();
        repository.ListAsync(1, 20, Arg.Any<CancellationToken>()).Returns(new PagedResult<Setting>([setting], 1, 20, 1));
        var handler = new ListSettingsQueryHandler(repository);

        var result = await handler.Handle(new ListSettingsQuery(1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(setting.Key, result.Value.Items[0].Key);
    }
}
