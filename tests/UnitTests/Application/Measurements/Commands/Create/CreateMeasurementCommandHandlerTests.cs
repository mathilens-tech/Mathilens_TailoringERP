using MathilensERP.Application.Customers;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Commands.Create;
using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Measurements;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Commands.Create;

public class CreateMeasurementCommandHandlerTests
{
    private static readonly Dictionary<string, MeasurementValue> Values = new() { ["Chest"] = MeasurementValue.FromNumber(40m) };

    [Fact]
    public async Task Handle_WithExistingCustomerAndNoExistingMeasurement_CreatesMeasurement()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var measurementRepository = Substitute.For<IMeasurementRepository>();
        measurementRepository.ExistsForCustomerAndGarmentTypeAsync(customer.Id, GarmentTypes.Shirt, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new CreateMeasurementCommandHandler(measurementRepository, customerRepository);

        var result = await handler.Handle(new CreateMeasurementCommand(customer.Id, GarmentTypes.Shirt, Values), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(customer.Id, result.Value.CustomerId);
        Assert.Equal(GarmentTypes.Shirt, result.Value.GarmentType);
        measurementRepository.Received(1).Add(Arg.Any<Measurement>());
        await measurementRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var measurementRepository = Substitute.For<IMeasurementRepository>();
        var handler = new CreateMeasurementCommandHandler(measurementRepository, customerRepository);

        var result = await handler.Handle(new CreateMeasurementCommand(Guid.NewGuid(), GarmentTypes.Shirt, Values), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
        await measurementRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenMeasurementAlreadyExistsForGarmentType_ReturnsConflict()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var measurementRepository = Substitute.For<IMeasurementRepository>();
        measurementRepository.ExistsForCustomerAndGarmentTypeAsync(customer.Id, GarmentTypes.Shirt, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateMeasurementCommandHandler(measurementRepository, customerRepository);

        var result = await handler.Handle(new CreateMeasurementCommand(customer.Id, GarmentTypes.Shirt, Values), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Measurement.AlreadyExists", result.Error.Code);
        await measurementRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
