using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Queries.History;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Queries.History;

public class GetMeasurementHistoryQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedHistoryToDtos()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) });
        var snapshot = MeasurementHistory.CaptureSnapshot(measurement);
        var repository = Substitute.For<IMeasurementRepository>();
        repository.GetHistoryAsync(measurement.Id, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<MeasurementHistory>([snapshot], 1, 20, 1));
        var handler = new GetMeasurementHistoryQueryHandler(repository);

        var result = await handler.Handle(new GetMeasurementHistoryQuery(measurement.Id, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(snapshot.Id, result.Value.Items[0].Id);
    }
}
