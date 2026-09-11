using MathilensERP.Domain.Employees;
using MathilensERP.Application.Employees.Commands.Create;

namespace MathilensERP.UnitTests.Application.Employees.Commands.Create;

public class CreateEmployeeCommandValidatorTests
{
    private readonly CreateEmployeeCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "Ravi Kumar", "Tailor", "+91 98765 43210", "ravi@example.com", new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithOnlyTheMandatoryFields_Passes()
    {
        // Employee code, name and phone are mandatory; job title and email are not.
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithBlankFullName_Fails()
    {
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateEmployeeCommand.FullName));
    }

    [Fact]
    public void Validate_WithBlankEmployeeCode_Fails()
    {
        var result = _validator.Validate(new CreateEmployeeCommand("", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateEmployeeCommand.EmployeeCode));
    }

    [Fact]
    public void Validate_WithMissingPhoneNumber_Fails()
    {
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "Ravi Kumar", null, "", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateEmployeeCommand.PhoneNumber));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("12")]
    public void Validate_WithMalformedPhoneNumber_Fails(string phoneNumber)
    {
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "Ravi Kumar", null, phoneNumber, null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateEmployeeCommand.PhoneNumber));
    }

    [Fact]
    public void Validate_WithMalformedEmail_Fails()
    {
        var result = _validator.Validate(new CreateEmployeeCommand("EMP-001", "Ravi Kumar", null, "+91 98765 43210", "not-an-email", new DateOnly(2024, 1, 15), EmploymentType.FullTime));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateEmployeeCommand.Email));
    }
}
