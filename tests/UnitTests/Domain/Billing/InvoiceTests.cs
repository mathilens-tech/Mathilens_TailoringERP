using MathilensERP.Domain.Billing;

namespace MathilensERP.UnitTests.Domain.Billing;

public class InvoiceTests
{
    [Fact]
    public void Create_WithValidInputs_ComputesTotalAndStartsUnpaid()
    {
        var orderId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        var invoice = Invoice.Create(orderId, customerId, subtotal: 1000m, taxAmount: 50m, discountAmount: 100m);

        Assert.Equal(orderId, invoice.OrderId);
        Assert.Equal(customerId, invoice.CustomerId);
        Assert.Equal(1000m, invoice.Subtotal);
        Assert.Equal(950m, invoice.TotalAmount);
        Assert.Equal(0m, invoice.AmountPaid);
        Assert.Equal(950m, invoice.RemainingBalance);
        Assert.Equal(InvoiceStatus.Unpaid, invoice.Status);
        Assert.Empty(invoice.Payments);
    }

    [Fact]
    public void Create_WithZeroSubtotal_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 0m, 0m, 0m));
    }

    [Fact]
    public void Create_WithNegativeTax_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 100m, -1m, 0m));
    }

    [Fact]
    public void Create_WithDiscountExceedingSubtotalPlusTax_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 100m, 0m, 200m));
    }

    [Fact]
    public void RecordPayment_WithPartialAmount_SetsPartiallyPaid()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);

        invoice.RecordPayment(400m, PaymentMethod.Cash);

        Assert.Equal(400m, invoice.AmountPaid);
        Assert.Equal(600m, invoice.RemainingBalance);
        Assert.Equal(InvoiceStatus.PartiallyPaid, invoice.Status);
        Assert.Single(invoice.Payments);
    }

    [Fact]
    public void RecordPayment_CoveringFullBalance_SetsPaid()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);

        invoice.RecordPayment(600m, PaymentMethod.Cash);
        invoice.RecordPayment(400m, PaymentMethod.Upi);

        Assert.Equal(1000m, invoice.AmountPaid);
        Assert.Equal(0m, invoice.RemainingBalance);
        Assert.Equal(InvoiceStatus.Paid, invoice.Status);
        Assert.Equal(2, invoice.Payments.Count);
    }

    [Fact]
    public void RecordPayment_ExceedingRemainingBalance_Throws()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);

        Assert.Throws<InvalidOperationException>(() => invoice.RecordPayment(1001m, PaymentMethod.Cash));
    }

    [Fact]
    public void RecordPayment_WithNonPositiveAmount_Throws()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);

        Assert.Throws<InvalidOperationException>(() => invoice.RecordPayment(0m, PaymentMethod.Cash));
    }

    [Fact]
    public void CanAcceptPayment_OnVoidInvoice_ReturnsFalse()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        invoice.Void();

        Assert.False(invoice.CanAcceptPayment(100m));
    }

    [Fact]
    public void Void_OnUnpaidInvoice_SetsVoidStatus()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);

        invoice.Void();

        Assert.Equal(InvoiceStatus.Void, invoice.Status);
    }

    [Fact]
    public void Void_OnInvoiceWithPayments_Throws()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        invoice.RecordPayment(100m, PaymentMethod.Cash);

        Assert.Throws<InvalidOperationException>(() => invoice.Void());
    }

    [Fact]
    public void Void_AlreadyVoided_Throws()
    {
        var invoice = Invoice.Create(Guid.NewGuid(), Guid.NewGuid(), 1000m, 0m, 0m);
        invoice.Void();

        Assert.Throws<InvalidOperationException>(() => invoice.Void());
    }
}
