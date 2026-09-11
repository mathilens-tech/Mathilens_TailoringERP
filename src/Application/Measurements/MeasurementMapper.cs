using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements;

internal static class MeasurementMapper
{
    public static MeasurementDto ToDto(this Measurement measurement) =>
        new(measurement.Id, measurement.CustomerId, measurement.GarmentType, measurement.Values, measurement.Notes, measurement.CreatedAtUtc);

    public static MeasurementHistoryDto ToDto(this MeasurementHistory history) =>
        new(history.Id, history.MeasurementId, history.GarmentType, history.Values, history.CreatedAtUtc);
}
