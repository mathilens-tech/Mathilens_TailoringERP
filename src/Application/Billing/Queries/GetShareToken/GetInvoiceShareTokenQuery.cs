using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.GetShareToken;

/// <summary>The share token for an invoice, for staff about to hand a customer a link to it.</summary>
public sealed record GetInvoiceShareTokenQuery(Guid InvoiceId) : IQuery<Result<InvoiceShareTokenDto>>;

/// <summary>
/// The token alone. The page that asks for this knows the shop's own base URL and builds the link
/// from it — the server has no reliable idea what host the browser reached it on, and a link built
/// from the wrong one is worse than no link.
/// </summary>
public sealed record InvoiceShareTokenDto(string Token);

public sealed class GetInvoiceShareTokenQueryHandler
    : IQueryHandler<GetInvoiceShareTokenQuery, Result<InvoiceShareTokenDto>>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IInvoiceShareTokenService _shareTokens;

    public GetInvoiceShareTokenQueryHandler(IInvoiceRepository invoiceRepository, IInvoiceShareTokenService shareTokens)
    {
        _invoiceRepository = invoiceRepository;
        _shareTokens = shareTokens;
    }

    public async Task<Result<InvoiceShareTokenDto>> Handle(GetInvoiceShareTokenQuery query, CancellationToken cancellationToken)
    {
        // Checked against the books rather than minted from the id straight off: a token for an
        // invoice that does not exist would sail through here and fail as a broken link in a
        // customer's hand, which is the one place this must not fail.
        var invoice = await _invoiceRepository.GetByIdAsync(query.InvoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result.Failure<InvoiceShareTokenDto>(
                Error.NotFound("Invoice.NotFound", $"No invoice was found with id '{query.InvoiceId}'."));
        }

        return new InvoiceShareTokenDto(_shareTokens.Create(invoice.Id));
    }
}
