using FluentValidation;
using MathilensERP.Application.Common.Behaviors;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.UnitTests.Application.Common.Behaviors;

file sealed record CreateThingCommand(string Name) : ICommand<Result<string>>;

file sealed class CreateThingCommandValidator : AbstractValidator<CreateThingCommand>
{
    public CreateThingCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
    }
}

file sealed record PlainResultCommand(string Name) : ICommand<Result>;

file sealed class PlainResultCommandValidator : AbstractValidator<PlainResultCommand>
{
    public PlainResultCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
    }
}

public class ValidationBehaviorTests
{
    [Fact]
    public async Task Handle_WithNoValidators_CallsNext()
    {
        var behavior = new ValidationBehavior<CreateThingCommand, Result<string>>([]);
        var nextCalled = false;

        await behavior.Handle(new CreateThingCommand("ok"), Next, CancellationToken.None);

        Assert.True(nextCalled);

        Task<Result<string>> Next()
        {
            nextCalled = true;
            return Task.FromResult(Result.Success("done"));
        }
    }

    [Fact]
    public async Task Handle_WithPassingValidation_CallsNext()
    {
        var behavior = new ValidationBehavior<CreateThingCommand, Result<string>>([new CreateThingCommandValidator()]);

        var result = await behavior.Handle(new CreateThingCommand("valid"), () => Task.FromResult(Result.Success("done")), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("done", result.Value);
    }

    [Fact]
    public async Task Handle_WithFailingValidation_ForGenericResult_ShortCircuitsWithValidationError()
    {
        var behavior = new ValidationBehavior<CreateThingCommand, Result<string>>([new CreateThingCommandValidator()]);
        var nextCalled = false;

        var result = await behavior.Handle(new CreateThingCommand(""), Next, CancellationToken.None);

        Assert.False(nextCalled);
        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error.Type);
        Assert.NotNull(result.Error.Details);
        Assert.Contains(result.Error.Details!, d => d.Field == "Name");

        Task<Result<string>> Next()
        {
            nextCalled = true;
            return Task.FromResult(Result.Success("should not run"));
        }
    }

    [Fact]
    public async Task Handle_WithFailingValidation_ForPlainResult_ShortCircuitsWithValidationError()
    {
        var behavior = new ValidationBehavior<PlainResultCommand, Result>([new PlainResultCommandValidator()]);

        var result = await behavior.Handle(new PlainResultCommand(""), () => Task.FromResult(Result.Success()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error.Type);
    }
}
