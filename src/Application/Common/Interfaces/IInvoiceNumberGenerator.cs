namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Issues the next invoice reference — "INV-2026-0001". The count restarts each January, so the
/// year is part of the number rather than decoration: without it, next year's 0001 would collide
/// with this year's.
/// </summary>
public interface IInvoiceNumberGenerator
{
    Task<string> NextAsync(CancellationToken cancellationToken);
}
