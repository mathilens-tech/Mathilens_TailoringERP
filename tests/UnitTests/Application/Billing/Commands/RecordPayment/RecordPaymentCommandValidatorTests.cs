using MathilensERP.Application.Billing.Commands.RecordPayment;
using MathilensERP.Domain.Billing;

namespace MathilensERP.UnitTests.Application.Billing.Commands.RecordPayment;

public class RecordPaymentCommandValidatorTests
{
    private readonly RecordPaymentCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new RecordPaymentCommand(Guid.NewGuid(), 100m, PaymentMethod.Cash));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithNonPositiveAmount_Fails()
    {
        var result = _validator.Validate(new RecordPaymentCommand(Guid.NewGuid(), 0m, PaymentMethod.Cash));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(RecordPaymentCommand.Amount));
    }
}
