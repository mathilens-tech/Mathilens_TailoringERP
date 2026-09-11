using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.WhatsApp;

/// <summary>Repository port for the <see cref="WhatsAppMessage"/> log (01_ARCHITECTURE.md § 25.1 Repository Pattern).</summary>
public interface IWhatsAppMessageRepository
{
    Task<WhatsAppMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<WhatsAppMessage>> SearchAsync(
        Guid? customerId, Guid? orderId, WhatsAppMessageStatus? status, int page, int pageSize, CancellationToken cancellationToken);

    void Add(WhatsAppMessage message);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
