using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Queries.Search;

public sealed record SearchWhatsAppMessagesQuery(
    Guid? CustomerId, Guid? OrderId, WhatsAppMessageStatus? Status, int Page, int PageSize) : IQuery<Result<PagedResult<WhatsAppMessageDto>>>;
