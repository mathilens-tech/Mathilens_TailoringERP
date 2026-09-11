using MathilensERP.Application.Reports;
using MathilensERP.Application.Reports.Queries.OrderStatusSummary;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OrderStatusSummary;

public class GetOrderStatusSummaryReportQueryHandlerTests
{
    [Fact]
    public async Task Handle_WrapsRepositoryCountsWithTheRequestedRange()
    {
        var fromUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var toUtc = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
        var counts = new List<OrderStatusCountDto> { new(OrderStatus.Received, 3), new(OrderStatus.Delivered, 7) };
        var repository = Substitute.For<IReportRepository>();
        repository.GetOrderStatusSummaryAsync(fromUtc, toUtc, Arg.Any<CancellationToken>()).Returns(counts);
        var handler = new GetOrderStatusSummaryReportQueryHandler(repository);

        var result = await handler.Handle(new GetOrderStatusSummaryReportQuery(fromUtc, toUtc), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(fromUtc, result.Value.FromUtc);
        Assert.Equal(toUtc, result.Value.ToUtc);
        Assert.Equal(counts, result.Value.StatusCounts);
    }
}
