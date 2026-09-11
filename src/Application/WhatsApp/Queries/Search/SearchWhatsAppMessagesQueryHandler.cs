using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Queries.Search;

public sealed class SearchWhatsAppMessagesQueryHandler : IQueryHandler<SearchWhatsAppMessagesQuery, Result<PagedResult<WhatsAppMessageDto>>>
{
    private readonly IWhatsAppMessageRepository _messageRepository;

    public SearchWhatsAppMessagesQueryHandler(IWhatsAppMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
    }

    public async Task<Result<PagedResult<WhatsAppMessageDto>>> Handle(SearchWhatsAppMessagesQuery query, CancellationToken cancellationToken)
    {
        var page = await _messageRepository.SearchAsync(query.CustomerId, query.OrderId, query.Status, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(m => m.ToDto()).ToList();

        return new PagedResult<WhatsAppMessageDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
