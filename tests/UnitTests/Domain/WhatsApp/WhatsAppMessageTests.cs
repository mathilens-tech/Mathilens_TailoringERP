using MathilensERP.Domain.WhatsApp;

namespace MathilensERP.UnitTests.Domain.WhatsApp;

public class WhatsAppMessageTests
{
    [Fact]
    public void Create_WithValidInputs_StartsInPendingStatus()
    {
        var customerId = Guid.NewGuid();
        var orderId = Guid.NewGuid();

        var message = WhatsAppMessage.Create(customerId, orderId, WhatsAppMessageType.OrderStatusUpdate, "Your order is ready.");

        Assert.NotEqual(Guid.Empty, message.Id);
        Assert.Equal(customerId, message.CustomerId);
        Assert.Equal(orderId, message.OrderId);
        Assert.Equal(WhatsAppMessageType.OrderStatusUpdate, message.MessageType);
        Assert.Equal("Your order is ready.", message.Content);
        Assert.Equal(WhatsAppMessageStatus.Pending, message.Status);
        Assert.Null(message.ProviderMessageId);
        Assert.Null(message.FailureReason);
    }

    [Fact]
    public void Create_WithoutOrderId_LeavesOrderIdNull()
    {
        var message = WhatsAppMessage.Create(Guid.NewGuid(), null, WhatsAppMessageType.Custom, "Hello!");

        Assert.Null(message.OrderId);
    }

    [Fact]
    public void Create_WithBlankContent_Throws()
    {
        Assert.Throws<ArgumentException>(() => WhatsAppMessage.Create(Guid.NewGuid(), null, WhatsAppMessageType.Custom, " "));
    }

    [Fact]
    public void MarkSent_SetsStatusAndProviderMessageId()
    {
        var message = WhatsAppMessage.Create(Guid.NewGuid(), null, WhatsAppMessageType.DeliveryReminder, "Pick up your order.");

        message.MarkSent("wamid.abc123");

        Assert.Equal(WhatsAppMessageStatus.Sent, message.Status);
        Assert.Equal("wamid.abc123", message.ProviderMessageId);
        Assert.Null(message.FailureReason);
    }

    [Fact]
    public void MarkFailed_SetsStatusAndFailureReason()
    {
        var message = WhatsAppMessage.Create(Guid.NewGuid(), null, WhatsAppMessageType.DeliveryReminder, "Pick up your order.");

        message.MarkFailed("Recipient number is not on WhatsApp.");

        Assert.Equal(WhatsAppMessageStatus.Failed, message.Status);
        Assert.Equal("Recipient number is not on WhatsApp.", message.FailureReason);
    }
}
