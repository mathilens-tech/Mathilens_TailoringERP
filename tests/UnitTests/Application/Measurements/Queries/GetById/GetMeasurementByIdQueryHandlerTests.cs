using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Queries.GetById;
using MathilensERP.Domain.Measurements;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Queries.GetById;

public class GetMeasurementByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingMeasurement_ReturnsDto()
    {
        var measurement = Measurement.Create(Guid.NewGuid(), GarmentTypes.Shirt, new Dictionary<string, MeasurementValue> { ["Chest"] = MeasurementValue.FromNumber(40m) });
        var repository = Substitute.For<IMeasurementRepository>();
        repository.GetByIdAsync(measurement.Id, Arg.Any<CancellationToken>()).Returns(measurement);
        var handler = new GetMeasurementByIdQueryHandler(repository);

        var result = await handler.Handle(new GetMeasurementByIdQuery(measurement.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(measurement.Id, result.Value.Id);
    }

    [Fact]
    public async Task Handle_WithUnknownMeasurement_ReturnsNotFound()
    {
        var repository = Substitute.For<IMeasurementRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Measurement?)null);
        var handler = new GetMeasurementByIdQueryHandler(repository);

        var result = await handler.Handle(new GetMeasurementByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Measurement.NotFound", result.Error.Code);
    }
}
