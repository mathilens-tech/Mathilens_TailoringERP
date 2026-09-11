using MathilensERP.Application.Activity;

namespace MathilensERP.Infrastructure.Persistence.Activity;

/// <summary>
/// Holds the field-level changes captured during one request until the activity trail is written.
///
/// Deliberately plain and deliberately scoped: a request is handled on one path, so there is no
/// second writer to guard against, and scoping it per request is what stops one user's edit being
/// attributed to another's.
/// </summary>
public class EntityChangeCollector : IEntityChangeCollector
{
    private readonly List<EntityChange> _changes = [];

    public void Record(IEnumerable<EntityChange> changes) => _changes.AddRange(changes);

    public IReadOnlyList<EntityChange> Drain()
    {
        if (_changes.Count == 0)
        {
            return [];
        }

        var drained = _changes.ToList();
        _changes.Clear();
        return drained;
    }
}
