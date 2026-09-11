using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Domain.Common;
using MathilensERP.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MathilensERP.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Stamps the standard audit footprint (02_DATABASE.md § 6) on every added/modified entity
/// implementing <see cref="IAuditable"/>, so no command handler has to remember to do it —
/// a cross-cutting concern, not hand-written per handler (01_ARCHITECTURE.md § 21 Audit Strategy).
/// </summary>
public class AuditableEntitySaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserService _currentUserService;

    public AuditableEntitySaveChangesInterceptor(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        UpdateAuditFields(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        UpdateAuditFields(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void UpdateAuditFields(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var userId = _currentUserService.UserId ?? SystemUsers.SystemUserId;
        var nowUtc = DateTime.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries<IAuditable>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.SetCreationAudit(userId, nowUtc);
                    break;
                case EntityState.Modified:
                    entry.Entity.SetModificationAudit(userId, nowUtc);
                    break;
            }
        }
    }
}
