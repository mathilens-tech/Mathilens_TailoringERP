using MathilensERP.Application.Billing.Commands.Create;

namespace MathilensERP.UnitTests.Application.Billing.Commands.Create;

public class CreateInvoiceCommandValidatorTests
{
    private readonly CreateInvoiceCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new CreateInvoiceCommand(Guid.NewGuid(), 50m, 10m));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyOrderId_Fails()
    {
        var result = _validator.Validate(new CreateInvoiceCommand(Guid.Empty, 0m, 0m));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateInvoiceCommand.OrderId));
    }

    [Fact]
    public void Validate_WithNegativeTax_Fails()
    {
        var result = _validator.Validate(new CreateInvoiceCommand(Guid.NewGuid(), -1m, 0m));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateInvoiceCommand.TaxAmount));
    }

    [Fact]
    public void Validate_WithNegativeDiscount_Fails()
    {
        var result = _validator.Validate(new CreateInvoiceCommand(Guid.NewGuid(), 0m, -1m));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateInvoiceCommand.DiscountAmount));
    }
}
