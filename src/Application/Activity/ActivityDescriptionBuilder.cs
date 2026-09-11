using System.Reflection;

namespace MathilensERP.Application.Activity;

/// <summary>
/// Turns the command behind an action into the details a person can read back:
/// <c>CreateCustomerCommand("Asha Rao", "98765 43210", …)</c> becomes
/// "Full Name: Asha Rao, Phone Number: 98765 43210".
///
/// Read off the command's own properties rather than declared per command, matching how
/// <see cref="ActivityDescriptor"/> already derives screen and action — a command written next
/// month describes itself without anyone registering it.
///
/// WHAT THIS CAN AND CANNOT SAY. A command carries the values being written, so a create is
/// described in full and an edit is described by what it was changed *to*. The before-and-after
/// is not read here — the pipeline never sees the row as it stood beforehand — it is captured off
/// the change tracker as the write happens; see <see cref="EntityChange"/>. A delete carries only
/// an id, so it says only which record.
/// </summary>
public static class ActivityDescriptionBuilder
{
    /// <summary>Fits the Description column with room to spare; a longer entry is truncated, not dropped.</summary>
    private const int MaxLength = 2000;

    public static string? Describe(object? request)
    {
        if (request is null)
        {
            return null;
        }

        var parts = new List<string>();

        foreach (var property in request.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.GetIndexParameters().Length > 0)
            {
                // Indexers cannot be read without an argument; records never have one anyway.
                continue;
            }

            if (property.Name is "Id")
            {
                // The bare record id. Which row it was is what Screen and Action already say, and
                // the trail is meant to read as labels and values a person recognises.
                continue;
            }

            var label = ActivityValues.Humanize(property.Name);

            if (ActivityValues.IsSecret(property.Name))
            {
                parts.Add($"{label}: {ActivityValues.Redacted}");
                continue;
            }

            object? value;
            try
            {
                value = property.GetValue(request);
            }
            catch (TargetInvocationException)
            {
                // A computed property that throws must not cost the caller their audit entry.
                continue;
            }

            var formatted = ActivityValues.Format(value);
            if (formatted is not null)
            {
                parts.Add($"{label}: {formatted}");
            }
        }

        if (parts.Count == 0)
        {
            return null;
        }

        var description = string.Join(", ", parts);
        return description.Length <= MaxLength ? description : description[..(MaxLength - 1)] + "…";
    }
}
