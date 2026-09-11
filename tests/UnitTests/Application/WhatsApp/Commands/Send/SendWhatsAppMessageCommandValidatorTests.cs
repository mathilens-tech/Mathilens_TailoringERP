using MathilensERP.Application.WhatsApp.Commands.Send;
using MathilensERP.Domain.WhatsApp;

namespace MathilensERP.UnitTests.Application.WhatsApp.Commands.Send;

public class SendWhatsAppMessageCommandValidatorTests
{
    private readonly SendWhatsAppMessageCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new SendWhatsAppMessageCommand(Guid.NewGuid(), null, WhatsAppMessageType.Custom, "Hello!"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyCustomerId_Fails()
    {
        var result = _validator.Validate(new SendWhatsAppMessageCommand(Guid.Empty, null, WhatsAppMessageType.Custom, "Hello!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SendWhatsAppMessageCommand.CustomerId));
    }

    [Fact]
    public void Validate_WithBlankContent_Fails()
    {
        var result = _validator.Validate(new SendWhatsAppMessageCommand(Guid.NewGuid(), null, WhatsAppMessageType.Custom, ""));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SendWhatsAppMessageCommand.Content));
    }

    [Fact]
    public void Validate_WithUndefinedMessageType_Fails()
    {
        var result = _validator.Validate(new SendWhatsAppMessageCommand(Guid.NewGuid(), null, (WhatsAppMessageType)999, "Hello!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SendWhatsAppMessageCommand.MessageType));
    }
}
