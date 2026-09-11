using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Commands.RecordPayment;
using MathilensERP.Domain.Billing;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Billing.Commands.RecordPayment;

public class RecordPaymentCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithAcceptableAmount_RecordsPaymentAndSaves()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(invoice.Id, Arg.Any<CancellationToken>()).Returns(invoice);
        var handler = new RecordPaymentCommandHandler(repository);

        var result = await handler.Handle(new RecordPaymentCommand(invoice.Id, 400m, PaymentMethod.Cash), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(400m, result.Value.AmountPaid);
        Assert.Equal(InvoiceStatus.PartiallyPaid, result.Value.Status);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownInvoice_ReturnsNotFound()
    {
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Invoice?)null);
        var handler = new RecordPaymentCommandHandler(repository);

        var result = await handler.Handle(new RecordPaymentCommand(Guid.NewGuid(), 100m, PaymentMethod.Cash), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithAmountExceedingBalance_ReturnsConflict()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(invoice.Id, Arg.Any<CancellationToken>()).Returns(invoice);
        var handler = new RecordPaymentCommandHandler(repository);

        var result = await handler.Handle(new RecordPaymentCommand(invoice.Id, 1001m, PaymentMethod.Cash), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.PaymentNotAcceptable", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
