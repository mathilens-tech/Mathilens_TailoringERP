using MathilensERP.Domain.Employees;

namespace MathilensERP.UnitTests.Domain.Employees;

public class EmployeeTests
{
    [Fact]
    public void Create_WithValidInputs_SetsAllFields()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", "Master Tailor", "+91 98765 43210", "ravi@example.com", new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.NotEqual(Guid.Empty, employee.Id);
        Assert.Equal("EMP-001", employee.EmployeeCode);
        Assert.Equal("Ravi Kumar", employee.FullName);
        Assert.Equal("Master Tailor", employee.JobTitle);
        // Stored canonically however it was typed, by the same rule as a customer's.
        Assert.Equal("+919876543210", employee.PhoneNumber);
        Assert.Equal("ravi@example.com", employee.Email);
        Assert.Null(employee.UserId);
    }

    [Fact]
    public void Create_WithOnlyRequiredFields_LeavesOptionalFieldsNull()
    {
        // Code, name and phone are the required three; job title and email remain optional.
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.Null(employee.JobTitle);
        Assert.Null(employee.Email);
    }

    [Fact]
    public void Create_WithBlankFullName_Throws()
    {
        Assert.Throws<ArgumentException>(() => Employee.Create("EMP-001", " ", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));
    }

    [Fact]
    public void Create_WithBlankEmployeeCode_Throws()
    {
        Assert.Throws<ArgumentException>(() => Employee.Create(" ", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));
    }

    [Fact]
    public void Create_WithBlankPhoneNumber_Throws()
    {
        Assert.Throws<ArgumentException>(() => Employee.Create("EMP-001", "Ravi Kumar", null, " ", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));
    }

    [Fact]
    public void Create_TrimsTheFieldsComparedForUniqueness()
    {
        // A trailing space must not be what makes a second record look distinct.
        var employee = Employee.Create("  EMP-001  ", "Ravi Kumar", null, "  +91 98765 43210  ", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.Equal("EMP-001", employee.EmployeeCode);
        // Stored canonically however it was typed, by the same rule as a customer's.
        Assert.Equal("+919876543210", employee.PhoneNumber);
    }

    [Fact]
    public void UpdateDetails_ReplacesAllFields()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", "Tailor", "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        employee.UpdateDetails("EMP-002", "Ravi K.", "Master Tailor", "+91 90000 00000", "ravi.k@example.com", new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.Equal("EMP-002", employee.EmployeeCode);
        Assert.Equal("Ravi K.", employee.FullName);
        Assert.Equal("Master Tailor", employee.JobTitle);
        Assert.Equal("+919000000000", employee.PhoneNumber);
        Assert.Equal("ravi.k@example.com", employee.Email);
    }

    [Fact]
    public void UpdateDetails_WithBlankFullName_Throws()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.Throws<ArgumentException>(() => employee.UpdateDetails("EMP-001", " ", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));
    }

    [Fact]
    public void UpdateDetails_WithBlankPhoneNumber_Throws()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.Throws<ArgumentException>(() => employee.UpdateDetails("EMP-001", "Ravi Kumar", null, " ", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime));
    }

    [Fact]
    public void Retire_RecordsTheLastWorkingDateWithoutDeletingThem()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        employee.Retire(new DateOnly(2026, 3, 31));

        // Retiring is not a delete: their history, code and phone all stay theirs.
        Assert.Equal(new DateOnly(2026, 3, 31), employee.LastWorkingDate);
        Assert.False(employee.IsDeleted);
        Assert.Equal("EMP-001", employee.EmployeeCode);
    }

    [Fact]
    public void IsActiveOn_IsTrueUpToAndIncludingTheLastWorkingDay()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        employee.Retire(new DateOnly(2026, 3, 31));

        Assert.True(employee.IsActiveOn(new DateOnly(2026, 3, 30)));
        // Their final day is still a working day.
        Assert.True(employee.IsActiveOn(new DateOnly(2026, 3, 31)));
        Assert.False(employee.IsActiveOn(new DateOnly(2026, 4, 1)));
    }

    [Fact]
    public void IsActiveOn_IsTrueForeverWhileNobodyHasRetiredThem()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        Assert.True(employee.IsActiveOn(new DateOnly(2099, 1, 1)));
    }

    [Fact]
    public void Retire_BeforeTheJoiningDate_Throws()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        // An employment that ran backwards is not a state the shop can be in.
        Assert.Throws<ArgumentException>(() => employee.Retire(new DateOnly(2023, 12, 31)));
    }

    [Fact]
    public void ReturnToWork_ClearsTheRetirement()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        employee.Retire(new DateOnly(2026, 3, 31));

        employee.ReturnToWork();

        Assert.Null(employee.LastWorkingDate);
        Assert.True(employee.IsActiveOn(new DateOnly(2026, 4, 1)));
    }

    [Fact]
    public void UpdateDetails_WithAJoiningDateAfterTheLastWorkingDate_Throws()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        employee.Retire(new DateOnly(2026, 3, 31));

        Assert.Throws<ArgumentException>(() => employee.UpdateDetails(
            "EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2026, 6, 1), EmploymentType.Contract));
    }
}
