using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Commands.UpdateValues;
using MathilensERP.Domain.Measurements;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Commands.UpdateValues;

public class UpdateMeasurementValuesCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingMeasurement_SnapshotsHistoryThenUpdates()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) });
        var repository = Substitute.For<IMeasurementRepository>();
        repository.GetByIdAsync(measurement.Id, Arg.Any<CancellationToken>()).Returns(measurement);
        MeasurementHistory? capturedSnapshot = null;
        repository.When(r => r.AddHistory(Arg.Any<MeasurementHistory>())).Do(callInfo => capturedSnapshot = callInfo.Arg<MeasurementHistory>());
        var handler = new UpdateMeasurementValuesCommandHandler(repository);
        var newValues = new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(42m) };

        var result = await handler.Handle(new UpdateMeasurementValuesCommand(measurement.Id, newValues), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(42m, result.Value.Values["Chest"].Number);
        Assert.NotNull(capturedSnapshot);
        Assert.Equal(40m, capturedSnapshot.Values["Chest"].Number);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownMeasurement_ReturnsNotFound()
    {
        var repository = Substitute.For<IMeasurementRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Measurement?)null);
        var handler = new UpdateMeasurementValuesCommandHandler(repository);

        var result = await handler.Handle(
            new UpdateMeasurementValuesCommand(Guid.NewGuid(), new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(42m) }), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Measurement.NotFound", result.Error.Code);
        repository.DidNotReceive().AddHistory(Arg.Any<MeasurementHistory>());
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
