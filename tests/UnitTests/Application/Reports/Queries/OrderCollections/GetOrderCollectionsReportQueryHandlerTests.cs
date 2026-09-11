using MathilensERP.Application.Reports;
using MathilensERP.Application.Reports.Queries.OrderCollections;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OrderCollections;

public class GetOrderCollectionsReportQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsReportFromRepository()
    {
        var fromUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var toUtc = new DateTime(2026, 1, 31, 23, 59, 59, DateTimeKind.Utc);
        var expected = new OrderCollectionsReportDto(fromUtc, toUtc, 12, 48000m, 30000m, 26000m, 22000m, 3500m, 1200m);
        var repository = Substitute.For<IReportRepository>();
        repository.GetOrderCollectionsAsync(fromUtc, toUtc, Arg.Any<CancellationToken>()).Returns(expected);
        var handler = new GetOrderCollectionsReportQueryHandler(repository);

        var result = await handler.Handle(new GetOrderCollectionsReportQuery(fromUtc, toUtc), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(expected, result.Value);
    }
}
