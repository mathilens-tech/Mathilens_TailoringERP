using MathilensERP.Domain.Measurements;

namespace MathilensERP.UnitTests.Domain.Measurements;

public class MeasurementHistoryTests
{
    [Fact]
    public void CaptureSnapshot_CopiesCurrentValuesFromMeasurement()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Trousers, new Dictionary<string, MeasurementValue> { ["Waist"] = MeasurementValue.FromNumber(34m), ["Inseam"] = MeasurementValue.FromNumber(30m) });

        var snapshot = MeasurementHistory.CaptureSnapshot(measurement);

        Assert.Equal(measurement.Id, snapshot.MeasurementId);
        Assert.Equal(GarmentTypes.Trousers, snapshot.GarmentType);
        Assert.Equal(34m, snapshot.Values["Waist"].Number);
        Assert.Equal(30m, snapshot.Values["Inseam"].Number);
    }

    [Fact]
    public void CaptureSnapshot_ReflectsValuesAtCaptureTime_NotLaterUpdates()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Trousers, new Dictionary<string, MeasurementValue> { ["Waist"] = MeasurementValue.FromNumber(34m) });

        var snapshot = MeasurementHistory.CaptureSnapshot(measurement);
        measurement.UpdateValues(new Dictionary<string, MeasurementValue> { ["Waist"] = MeasurementValue.FromNumber(36m) });

        Assert.Equal(34m, snapshot.Values["Waist"].Number);
        Assert.Equal(36m, measurement.Values["Waist"].Number);
    }
}
