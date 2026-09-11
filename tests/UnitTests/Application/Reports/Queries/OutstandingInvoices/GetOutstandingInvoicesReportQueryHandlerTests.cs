using MathilensERP.Application.Reports;
using MathilensERP.Application.Reports.Queries.OutstandingInvoices;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OutstandingInvoices;

public class GetOutstandingInvoicesReportQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsPagedResultFromRepository()
    {
        var invoice = new OutstandingInvoiceDto(Guid.NewGuid(), Guid.NewGuid(), 1000m, 400m, 600m, InvoiceStatus.PartiallyPaid, DateTime.UtcNow);
        var repository = Substitute.For<IReportRepository>();
        repository.GetOutstandingInvoicesAsync(1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<OutstandingInvoiceDto>([invoice], 1, 20, 1));
        var handler = new GetOutstandingInvoicesReportQueryHandler(repository);

        var result = await handler.Handle(new GetOutstandingInvoicesReportQuery(1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(600m, result.Value.Items[0].RemainingBalance);
    }
}
