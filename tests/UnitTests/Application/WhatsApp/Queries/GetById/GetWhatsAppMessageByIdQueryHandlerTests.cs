using MathilensERP.Application.WhatsApp;
using MathilensERP.Application.WhatsApp.Queries.GetById;
using MathilensERP.Domain.WhatsApp;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.WhatsApp.Queries.GetById;

public class GetWhatsAppMessageByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingMessage_ReturnsDto()
    {
        var message = WhatsAppMessage.Create(Guid.NewGuid(), null, WhatsAppMessageType.Custom, "Hi");
        var repository = Substitute.For<IWhatsAppMessageRepository>();
        repository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>()).Returns(message);
        var handler = new GetWhatsAppMessageByIdQueryHandler(repository);

        var result = await handler.Handle(new GetWhatsAppMessageByIdQuery(message.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(message.Id, result.Value.Id);
    }

    [Fact]
    public async Task Handle_WithUnknownMessage_ReturnsNotFound()
    {
        var repository = Substitute.For<IWhatsAppMessageRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((WhatsAppMessage?)null);
        var handler = new GetWhatsAppMessageByIdQueryHandler(repository);

        var result = await handler.Handle(new GetWhatsAppMessageByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("WhatsAppMessage.NotFound", result.Error.Code);
    }
}
