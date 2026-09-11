using MathilensERP.Application.Customers.Commands.Create;

namespace MathilensERP.UnitTests.Application.Customers.Commands.Create;

public class CreateCustomerCommandValidatorTests
{
    private readonly CreateCustomerCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "+91 98765 43210", "asha@example.com", "12 MG Road", "Notes"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithBlankFullName_Fails()
    {
        var result = _validator.Validate(new CreateCustomerCommand("", "+91 98765 43210", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateCustomerCommand.FullName));
    }

    [Fact]
    public void Validate_WithBlankPhoneNumber_Fails()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateCustomerCommand.PhoneNumber));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("12")]
    public void Validate_WithMalformedPhoneNumber_Fails(string phoneNumber)
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", phoneNumber, null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateCustomerCommand.PhoneNumber));
    }

    [Fact]
    public void Validate_WithMalformedEmail_Fails()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "+91 98765 43210", "not-an-email", null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateCustomerCommand.Email));
    }

    [Fact]
    public void Validate_WithNullEmail_Passes()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "+91 98765 43210", null, null, null));

        Assert.True(result.IsValid);
    }

    /// <summary>FR-03's example — the message has to name the actual fault, not just refuse.</summary>
    [Fact]
    public void Validate_WithANineDigitPhoneNumber_FailsSayingTenDigits()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "994337849", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Phone number must be 10 digits.");
    }

    /// <summary>Ten digits and still wrong: counting them again would not find the problem.</summary>
    [Fact]
    public void Validate_WithANumberOutsideTheMobileSeries_FailsSayingSoExplicitly()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "1234567890", null, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Phone number must start with 6, 7, 8 or 9.");
    }

    /// <summary>One fault, one message — a blank field is not also a length problem.</summary>
    [Fact]
    public void Validate_WithBlankPhoneNumber_ReportsOnlyThatItIsRequired()
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", "", null, null, null));

        var phoneErrors = result.Errors
            .Where(e => e.PropertyName == nameof(CreateCustomerCommand.PhoneNumber))
            .ToList();

        Assert.Single(phoneErrors);
        Assert.Equal("Phone number is required.", phoneErrors[0].ErrorMessage);
    }

    /// <summary>FR-02's example, which the previous EmailAddress() rule let through.</summary>
    [Fact]
    public void Validate_WithACommaInTheEmail_Fails()
    {
        var result = _validator.Validate(
            new CreateCustomerCommand("Asha Rao", "+91 98765 43210", "kamalesh@gmail,com", null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Enter a valid email address.");
    }

    /// <summary>Every shape of one number gets past the form, because they are one number.</summary>
    [Theory]
    [InlineData("8220070369")]
    [InlineData("918220070369")]
    [InlineData("+918220070369")]
    public void Validate_WithAnyShapeOfAValidNumber_Passes(string phoneNumber)
    {
        var result = _validator.Validate(new CreateCustomerCommand("Asha Rao", phoneNumber, null, null, null));

        Assert.True(result.IsValid);
    }
}
