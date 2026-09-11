using MathilensERP.Application.Orders.Commands.Create;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Application.Orders.Commands.Create;

public class CreateOrderCommandValidatorTests
{
    private readonly CreateOrderCommandValidator _validator = new();

    private static CreateOrderCommand ValidCommand() =>
        new(Guid.NewGuid(), null, DateTime.UtcNow.AddDays(7), [new CreateOrderItemInput(GarmentTypes.Shirt, 1, 500m, null)]);

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(ValidCommand());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyCustomerId_Fails()
    {
        var command = ValidCommand() with { CustomerId = Guid.Empty };

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateOrderCommand.CustomerId));
    }

    [Fact]
    public void Validate_WithNoItems_Fails()
    {
        var command = ValidCommand() with { Items = [] };

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateOrderCommand.Items));
    }

    [Fact]
    public void Validate_WithNonPositiveItemQuantity_Fails()
    {
        var command = ValidCommand() with { Items = [new CreateOrderItemInput(GarmentTypes.Shirt, 0, 500m, null)] };

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WithFabricMissingType_Fails()
    {
        var command = ValidCommand() with
        {
            Items = [new CreateOrderItemInput(GarmentTypes.Shirt, 1, 500m, new CreateOrderItemFabricInput("", FabricSource.ShopSupplied, null, 2m))],
        };

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
    }
}
