using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Commands.Void;
using MathilensERP.Domain.Billing;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Billing.Commands.Void;

public class VoidInvoiceCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithUnpaidInvoice_VoidsAndSaves()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(invoice.Id, Arg.Any<CancellationToken>()).Returns(invoice);
        var handler = new VoidInvoiceCommandHandler(repository);

        var result = await handler.Handle(new VoidInvoiceCommand(invoice.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(InvoiceStatus.Void, invoice.Status);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithPaidInvoice_ReturnsConflict()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        invoice.RecordPayment(1000m, PaymentMethod.Cash);
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(invoice.Id, Arg.Any<CancellationToken>()).Returns(invoice);
        var handler = new VoidInvoiceCommandHandler(repository);

        var result = await handler.Handle(new VoidInvoiceCommand(invoice.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.CannotVoid", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownInvoice_ReturnsNotFound()
    {
        var repository = Substitute.For<IInvoiceRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Invoice?)null);
        var handler = new VoidInvoiceCommandHandler(repository);

        var result = await handler.Handle(new VoidInvoiceCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.NotFound", result.Error.Code);
    }
}
