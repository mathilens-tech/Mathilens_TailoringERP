using MathilensERP.Shared.Results;

namespace MathilensERP.UnitTests.Shared;

public class ResultTests
{
    [Fact]
    public void Success_WithNoValue_IsSuccessAndHasNoError()
    {
        var result = Result.Success();

        Assert.True(result.IsSuccess);
        Assert.False(result.IsFailure);
        Assert.Equal(Error.None, result.Error);
    }

    [Fact]
    public void Failure_WithError_IsFailureAndCarriesError()
    {
        var error = Error.NotFound("Customer.NotFound", "Customer was not found.");

        var result = Result.Failure(error);

        Assert.False(result.IsSuccess);
        Assert.True(result.IsFailure);
        Assert.Equal(error, result.Error);
    }

    [Fact]
    public void Success_WithValue_ExposesValue()
    {
        var result = Result.Success(42);

        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void Failure_WithValue_ThrowsWhenValueAccessed()
    {
        var result = Result.Failure<int>(Error.Validation("Field.Invalid", "Invalid field."));

        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void ImplicitConversion_FromValue_ProducesSuccessResult()
    {
        Result<string> result = "hello";

        Assert.True(result.IsSuccess);
        Assert.Equal("hello", result.Value);
    }

    [Fact]
    public void Error_ValidationWithDetails_CarriesFieldErrors()
    {
        var details = new[] { new FieldError("email", "Email is not valid.") };

        var error = Error.Validation("VALIDATION_ERROR", "One or more fields are invalid.", details);

        Assert.Equal(ErrorType.Validation, error.Type);
        Assert.Single(error.Details!);
        Assert.Equal("email", error.Details![0].Field);
    }
}
