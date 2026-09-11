using FluentValidation;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Common.Behaviors;

/// <summary>
/// Runs every registered <see cref="IValidator{T}"/> for the request before the handler
/// executes, short-circuiting with a validation <see cref="Error"/> on failure
/// (01_ARCHITECTURE.md § 11 Validation Strategy). Handlers never manually check "is this
/// field present" — that is this behavior's job, uniformly, for every command/query.
///
/// Constrained to <typeparamref name="TResponse"/> : Result so it can construct a failure
/// of the correct concrete type (Result or Result&lt;T&gt;) without each command/query
/// needing its own validation wiring.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TResponse : Result
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (!_validators.Any())
        {
            return await next();
        }

        var failures = new List<FieldError>();

        foreach (var validator in _validators)
        {
            var result = await validator.ValidateAsync(request!, cancellationToken);
            failures.AddRange(result.Errors.Select(e => new FieldError(e.PropertyName, e.ErrorMessage)));
        }

        if (failures.Count == 0)
        {
            return await next();
        }

        var error = Error.Validation("VALIDATION_ERROR", "One or more fields are invalid.", failures);

        return BuildFailureResponse(error);
    }

    private static TResponse BuildFailureResponse(Error error)
    {
        if (typeof(TResponse) == typeof(Result))
        {
            return (TResponse)(object)Result.Failure(error);
        }

        // TResponse is Result<TValue> — invoke the generic static factory via reflection,
        // since TValue is not known at this generic level.
        var valueType = typeof(TResponse).GetGenericArguments()[0];
        var failureMethod = typeof(Result)
            .GetMethods()
            .Single(m => m.Name == nameof(Result.Failure) && m.IsGenericMethodDefinition)
            .MakeGenericMethod(valueType);

        return (TResponse)failureMethod.Invoke(null, [error])!;
    }
}
