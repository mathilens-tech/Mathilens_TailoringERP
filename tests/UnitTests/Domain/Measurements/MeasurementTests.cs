using MathilensERP.Domain.Measurements;

namespace MathilensERP.UnitTests.Domain.Measurements;

public class MeasurementTests
{
    [Fact]
    public void Create_WithValidInputs_SetsAllFields()
    {
        var customerId = Guid.NewGuid();
        var values = new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m), ["Waist"] = MeasurementValue.FromNumber(34m) };

        var measurement = Measurement.Create(customerId, GarmentTypes.Shirt, values);

        Assert.NotEqual(Guid.Empty, measurement.Id);
        Assert.Equal(customerId, measurement.CustomerId);
        Assert.Equal(GarmentTypes.Shirt, measurement.GarmentType);
        Assert.Equal(40m, measurement.Values["Chest"].Number);
        Assert.Equal(34m, measurement.Values["Waist"].Number);
    }

    [Fact]
    public void Create_WithEmptyCustomerId_Throws()
    {
        var values = new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) };

        Assert.Throws<ArgumentException>(() => Measurement.Create(Guid.Empty, GarmentTypes.Shirt, values));
    }

    [Fact]
    public void Create_WithNoValues_Throws()
    {
        Assert.Throws<ArgumentException>(() => Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue>()));
    }

    [Fact]
    public void Create_WithNonPositiveValue_Throws()
    {
        var values = new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(0m) };

        Assert.Throws<ArgumentOutOfRangeException>(() => Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, values));
    }

    [Fact]
    public void Create_WithNegativeValue_Throws()
    {
        var values = new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(-5m) };

        Assert.Throws<ArgumentOutOfRangeException>(() => Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, values));
    }

    [Fact]
    public void UpdateValues_ReplacesValues()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) });

        measurement.UpdateValues(new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(42m), ["Sleeve"] = MeasurementValue.FromNumber(25m) });

        Assert.Equal(42m, measurement.Values["Chest"].Number);
        Assert.Equal(25m, measurement.Values["Sleeve"].Number);
        Assert.False(measurement.Values.ContainsKey("Waist"));
    }
}
