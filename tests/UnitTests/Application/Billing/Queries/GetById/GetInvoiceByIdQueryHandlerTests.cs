using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Queries.GetById;
using MathilensERP.Domain.Billing;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Billing.Queries.GetById;

public class GetInvoiceByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingInvoice_ReturnsDto()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(invoice.Id, Arg.Any<CancellationToken>()).Returns(invoice);
        var handler = new GetInvoiceByIdQueryHandler(repository);

        var result = await handler.Handle(new GetInvoiceByIdQuery(invoice.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(invoice.Id, result.Value.Id);
    }

    [Fact]
    public async Task Handle_WithUnknownInvoice_ReturnsNotFound()
    {
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Invoice?)null);
        var handler = new GetInvoiceByIdQueryHandler(repository);

        var result = await handler.Handle(new GetInvoiceByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.NotFound", result.Error.Code);
    }
}
