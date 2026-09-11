using MathilensERP.Application.Reports;
using MathilensERP.Application.Reports.Queries.Revenue;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Reports.Queries.Revenue;

public class GetRevenueReportQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsReportFromRepository()
    {
        var fromUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var toUtc = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
        var expected = new RevenueReportDto(fromUtc, toUtc, 5, 10000m, 6000m, 4000m);
        var repository = Substitute.For<IReportRepository>();
        repository.GetRevenueAsync(fromUtc, toUtc, Arg.Any<CancellationToken>()).Returns(expected);
        var handler = new GetRevenueReportQueryHandler(repository);

        var result = await handler.Handle(new GetRevenueReportQuery(fromUtc, toUtc), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(expected, result.Value);
    }
}
