using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Queries.Search;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Billing.Queries.Search;

public class SearchInvoicesQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedInvoicesToDtos()
    {
        var customerId = Guid.NewGuid();
        var invoice = Invoice.Create(Guid.NewGuid(), customerId, 1000m, 0m, 0m);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.SearchAsync(customerId, InvoiceStatus.Unpaid, null, null, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Invoice>([invoice], 1, 20, 1));
        var handler = new SearchInvoicesQueryHandler(repository);

        var result = await handler.Handle(
            new SearchInvoicesQuery(customerId, InvoiceStatus.Unpaid, null, null, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(invoice.Id, result.Value.Items[0].Id);
    }

    [Fact]
    public async Task Handle_PassesDateRangeThroughToTheRepository()
    {
        var from = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 8, 14, 0, 0, 0, DateTimeKind.Utc);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.SearchAsync(null, null, from, to, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Invoice>([], 1, 20, 0));
        var handler = new SearchInvoicesQueryHandler(repository);

        var result = await handler.Handle(new SearchInvoicesQuery(null, null, from, to, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await repository.Received(1).SearchAsync(null, null, from, to, 1, 20, Arg.Any<CancellationToken>());
    }
}
