using MathilensERP.Domain.Customers;

namespace MathilensERP.UnitTests.Domain.Customers;

public class CustomerTests
{
    [Fact]
    public void Create_WithValidInputs_SetsAllFields()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", "asha@example.com", "12 MG Road", "Prefers cotton");

        Assert.NotEqual(Guid.Empty, customer.Id);
        Assert.Equal("Asha Rao", customer.FullName);
        // Stored canonically however it was typed, so it can be compared for uniqueness (FR-01).
        Assert.Equal("+919876543210", customer.PhoneNumber);
        Assert.Equal("asha@example.com", customer.Email);
        Assert.Equal("12 MG Road", customer.Address);
        Assert.Equal("Prefers cotton", customer.Notes);
    }

    [Fact]
    public void Create_WithOnlyRequiredFields_LeavesOptionalFieldsNull()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);

        Assert.Null(customer.Email);
        Assert.Null(customer.Address);
        Assert.Null(customer.Notes);
    }

    [Fact]
    public void Create_WithBlankFullName_Throws()
    {
        Assert.Throws<ArgumentException>(() => Customer.Create(" ", "+91 98765 43210", null, null, null));
    }

    [Fact]
    public void Create_WithBlankPhoneNumber_Throws()
    {
        Assert.Throws<ArgumentException>(() => Customer.Create("Asha Rao", " ", null, null, null));
    }

    [Fact]
    public void UpdateDetails_ReplacesAllFields()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);

        customer.UpdateDetails("Asha K. Rao", "+91 90000 00000", "asha.k@example.com", "New Address", "Updated notes");

        Assert.Equal("Asha K. Rao", customer.FullName);
        Assert.Equal("+919000000000", customer.PhoneNumber);
        Assert.Equal("asha.k@example.com", customer.Email);
        Assert.Equal("New Address", customer.Address);
        Assert.Equal("Updated notes", customer.Notes);
    }

    [Fact]
    public void UpdateDetails_WithBlankFullName_Throws()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);

        Assert.Throws<ArgumentException>(() => customer.UpdateDetails(" ", "+91 98765 43210", null, null, null));
    }
}
