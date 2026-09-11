namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Issues the next order number — the shop's code, a run letter, and a running count: "RFA-0001".
///
/// <para>
/// A port rather than something the handler works out for itself: the count has to be handed out
/// atomically or two orders taken at the same moment get the same number, and only the database can
/// promise that. Application says what it needs; Infrastructure owns how.
/// </para>
/// </summary>
public interface IOrderNumberGenerator
{
    /// <summary>
    /// Takes the next number. Each call consumes one, whether or not the order it was taken for is
    /// ever saved — a failed order therefore leaves a gap. That is the deliberate trade: the
    /// alternative is holding a lock across the whole save so numbers can be handed back, which
    /// serialises every order the shop takes to remove gaps nobody is counting.
    /// </summary>
    Task<string> NextAsync(CancellationToken cancellationToken);
}
