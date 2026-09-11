using MathilensERP.Application.WhatsApp;
using MathilensERP.Application.WhatsApp.Queries.Search;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.WhatsApp.Queries.Search;

public class SearchWhatsAppMessagesQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedMessagesToDtos()
    {
        var customerId = Guid.NewGuid();
        var message = WhatsAppMessage.Create(customerId, null, WhatsAppMessageType.Custom, "Hi");
        var repository = Substitute.For<IWhatsAppMessageRepository>();
        repository.SearchAsync(customerId, null, WhatsAppMessageStatus.Pending, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<WhatsAppMessage>([message], 1, 20, 1));
        var handler = new SearchWhatsAppMessagesQueryHandler(repository);

        var result = await handler.Handle(
            new SearchWhatsAppMessagesQuery(customerId, null, WhatsAppMessageStatus.Pending, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(message.Id, result.Value.Items[0].Id);
    }
}
