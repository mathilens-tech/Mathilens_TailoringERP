using MathilensERP.Application.Orders.Commands.TransitionStatus;
using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Application.Orders.Commands.TransitionStatus;

public class TransitionOrderStatusCommandValidatorTests
{
    private readonly TransitionOrderStatusCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new TransitionOrderStatusCommand(Guid.NewGuid(), OrderStatus.InProgress));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyOrderId_Fails()
    {
        var result = _validator.Validate(new TransitionOrderStatusCommand(Guid.Empty, OrderStatus.InProgress));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(TransitionOrderStatusCommand.OrderId));
    }

    [Fact]
    public void Validate_DeliveringWithoutADeliveryDate_Fails()
    {
        var result = _validator.Validate(new TransitionOrderStatusCommand(Guid.NewGuid(), OrderStatus.Delivered));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(TransitionOrderStatusCommand.DeliveredAtUtc));
    }

    [Fact]
    public void Validate_DeliveringWithADeliveryDate_Passes()
    {
        var result = _validator.Validate(new TransitionOrderStatusCommand(Guid.NewGuid(), OrderStatus.Delivered, DateTime.UtcNow));

        Assert.True(result.IsValid);
    }
}
