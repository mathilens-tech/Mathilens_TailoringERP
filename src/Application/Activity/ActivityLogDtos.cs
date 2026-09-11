namespace MathilensERP.Application.Activity;

public sealed record ActivityLogDto(
    Guid Id,
    Guid? UserId,
    string? UserName,
    string Screen,
    string Action,
    string RequestName,
    string? Description,
    /// <summary>What each edited field was and became. Empty for a create or a delete, which have only one side.</summary>
    IReadOnlyList<ActivityChangeDto> Changes,
    DateTime OccurredAtUtc);

/// <summary>One field's before-and-after, as the screen shows it. Mirrors <see cref="EntityChange"/>.</summary>
public sealed record ActivityChangeDto(string Entity, string Field, string? From, string? To);

/// <summary>The values actually present in the log, so the filters only ever offer what will return something.</summary>
public sealed record ActivityLogFiltersDto(IReadOnlyList<string> Screens, IReadOnlyList<ActivityLogUserDto> Users);

public sealed record ActivityLogUserDto(Guid UserId, string UserName);
