using MathilensERP.Application.Measurements.Commands.Create;
using MathilensERP.Domain.Measurements;

namespace MathilensERP.UnitTests.Application.Measurements.Commands.Create;

public class CreateMeasurementCommandValidatorTests
{
    private readonly CreateMeasurementCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) }));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyCustomerId_Fails()
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.Empty, GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) }));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateMeasurementCommand.CustomerId));
    }

    [Fact]
    public void Validate_WithNoValues_Fails()
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue>()));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateMeasurementCommand.Values));
    }

    [Fact]
    public void Validate_WithNonPositiveValue_Fails()
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(0m) }));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Chudidhar\twith a tab")]
    public void Validate_WithAnUnusableGarmentName_Fails(string garmentType)
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), garmentType, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) }));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateMeasurementCommand.GarmentType));
    }

    [Fact]
    public void Validate_WithAGarmentNameLongerThanTheColumn_Fails()
    {
        var tooLong = new string('a', GarmentTypes.MaxLength + 1);

        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), tooLong, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) }));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateMeasurementCommand.GarmentType));
    }

    /// <summary>
    /// The whole point of dropping the enum: a shop stitches what it stitches, and the API has to
    /// accept the garment it says it took an order for.
    /// </summary>
    [Theory]
    [InlineData("Chudidhar")]
    [InlineData("Saree")]
    [InlineData("Lehenga")]
    [InlineData("Saree Blouse")]
    public void Validate_WithAGarmentTheShopAdded_Passes(string garmentType)
    {
        var result = _validator.Validate(new CreateMeasurementCommand(Guid.NewGuid(), garmentType, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) }));

        Assert.True(result.IsValid);
    }
}
