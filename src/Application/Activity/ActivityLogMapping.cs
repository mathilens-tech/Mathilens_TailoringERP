using System.Text.Json;
using MathilensERP.Domain.Activity;

namespace MathilensERP.Application.Activity;

/// <summary>
/// One log row as the screen and the export both see it.
///
/// <para>Shared rather than written twice. The list and the download must agree about what an entry
/// says — an export that read a row differently from the page it was taken from would be the one
/// copy nobody could check — and the change-reading below carries a judgement that is easy to lose
/// in a second copy.</para>
/// </summary>
public static class ActivityLogMapping
{
    private static readonly JsonSerializerOptions ChangeJson = new(JsonSerializerDefaults.Web);

    public static ActivityLogDto ToDto(this ActivityLog log) =>
        new(log.Id, log.UserId, log.UserName, log.Screen, log.Action, log.RequestName,
            log.Description, ReadChanges(log.Changes), log.OccurredAtUtc);

    /// <summary>
    /// A row whose JSON cannot be read still has a date, a user and an action worth showing, so an
    /// unreadable value costs that one entry its detail rather than costing the caller the page.
    /// </summary>
    public static IReadOnlyList<ActivityChangeDto> ReadChanges(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<ActivityChangeDto>>(json, ChangeJson) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
