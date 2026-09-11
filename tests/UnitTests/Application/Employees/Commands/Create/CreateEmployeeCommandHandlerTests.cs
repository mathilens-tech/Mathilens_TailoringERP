using MathilensERP.Application.Employees;
using MathilensERP.Application.Employees.Commands.Create;
using MathilensERP.Domain.Employees;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Employees.Commands.Create;

public class CreateEmployeeCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithValidCommand_AddsEmployeeAndSavesChanges()
    {
        var repository = Substitute.For<IEmployeeRepository>();
        var handler = new CreateEmployeeCommandHandler(repository);
        var command = new CreateEmployeeCommand("EMP-001", "Ravi Kumar", "Master Tailor", "+91 98765 43210", "ravi@example.com", new DateOnly(2024, 1, 15), EmploymentType.FullTime);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Ravi Kumar", result.Value.FullName);
        Assert.Equal("Master Tailor", result.Value.JobTitle);
        repository.Received(1).Add(Arg.Any<Employee>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithEmployeeCodeAlreadyUsed_ReturnsConflictAndSavesNothing()
    {
        var existing = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var repository = Substitute.For<IEmployeeRepository>();
        repository.GetByEmployeeCodeAsync("EMP-001", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new CreateEmployeeCommandHandler(repository);

        var result = await handler.Handle(
            new CreateEmployeeCommand("EMP-001", "Someone Else", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.DuplicateEmployeeCode", result.Error.Code);
        repository.DidNotReceive().Add(Arg.Any<Employee>());
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithPhoneNumberAlreadyUsed_ReturnsConflictAndSavesNothing()
    {
        var existing = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var repository = Substitute.For<IEmployeeRepository>();
        // Stubbed on the canonical form, because that is what the uniqueness check looks up.
        repository.GetByPhoneNumberAsync("+919876543210", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new CreateEmployeeCommandHandler(repository);

        var result = await handler.Handle(
            new CreateEmployeeCommand("EMP-002", "Someone Else", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.DuplicatePhoneNumber", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithACodeAndPhoneNobodyElseHolds_Succeeds()
    {
        var repository = Substitute.For<IEmployeeRepository>();
        var handler = new CreateEmployeeCommandHandler(repository);

        var result = await handler.Handle(
            new CreateEmployeeCommand("EMP-002", "Meera S", null, "+91 90000 00000", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("+919000000000", result.Value.PhoneNumber);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The employee half of the rule that matters: before normalizing, typing a colleague's
    /// number in any other shape created a second staff record for the same person.
    /// </summary>
    [Theory]
    [InlineData("8220070363")]
    [InlineData("918220070363")]
    [InlineData("+91 82200-70363")]
    [InlineData("08220070363")]
    public async Task Handle_WithAnExistingNumberTypedInAnotherShape_StillDetectsTheDuplicate(string typed)
    {
        var existing = Employee.Create("EMP-001", "Ravi Kumar", null, "+918220070363", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var repository = Substitute.For<IEmployeeRepository>();
        repository.GetByPhoneNumberAsync("+918220070363", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new CreateEmployeeCommandHandler(repository);

        var result = await handler.Handle(
            new CreateEmployeeCommand("EMP-002", "Someone Else", null, typed, null, new DateOnly(2024, 1, 15), EmploymentType.FullTime),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.DuplicatePhoneNumber", result.Error.Code);
        repository.DidNotReceive().Add(Arg.Any<Employee>());
    }
}
