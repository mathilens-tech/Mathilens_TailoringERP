using MathilensERP.Application.Customers.Commands.Update;

namespace MathilensERP.UnitTests.Application.Customers.Commands.Update;

public class UpdateCustomerCommandValidatorTests
{
    private readonly UpdateCustomerCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new UpdateCustomerCommand(Guid.NewGuid(), "Asha Rao", "+91 98765 43210", null, null, null));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyId_Fails()
    {
        var result = _validator.Validate(new UpdateCustomerCommand(Guid.Empty, "Asha Rao", "+91 98765 43210", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateCustomerCommand.Id));
    }

    [Fact]
    public void Validate_WithBlankFullName_Fails()
    {
        var result = _validator.Validate(new UpdateCustomerCommand(Guid.NewGuid(), "", "+91 98765 43210", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateCustomerCommand.FullName));
    }
}
