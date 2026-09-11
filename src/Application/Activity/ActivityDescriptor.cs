using System.Text.RegularExpressions;

namespace MathilensERP.Application.Activity;

/// <summary>
/// Turns a command type into the screen and action a person would recognise, so the log reads
/// "Customers / Create Customer" rather than "CreateCustomerCommand".
///
/// Both are derived from the type rather than declared per command, which means a new command is
/// logged correctly the moment it exists — nothing to remember to register, matching how handlers
/// and validators are already discovered by assembly scanning.
/// </summary>
public static partial class ActivityDescriptor
{
    /// <summary>Falls back to this when a command sits outside the usual module namespace.</summary>
    private const string UnknownScreen = "General";

    /// <summary>
    /// The module segment of the namespace: <c>MathilensERP.Application.Customers.Commands.Create</c>
    /// gives "Customers".
    /// </summary>
    public static string ScreenFor(Type requestType)
    {
        const string applicationRoot = "MathilensERP.Application.";

        var ns = requestType.Namespace;
        if (ns is null || !ns.StartsWith(applicationRoot, StringComparison.Ordinal))
        {
            return UnknownScreen;
        }

        var remainder = ns[applicationRoot.Length..];
        var separator = remainder.IndexOf('.');
        var module = separator < 0 ? remainder : remainder[..separator];

        return string.IsNullOrWhiteSpace(module) ? UnknownScreen : module;
    }

    /// <summary><c>TransitionOrderStatusCommand</c> gives "Transition Order Status".</summary>
    public static string ActionFor(Type requestType)
    {
        var name = requestType.Name;
        if (name.EndsWith("Command", StringComparison.Ordinal))
        {
            name = name[..^"Command".Length];
        }

        return PascalCaseBoundary().Replace(name, " $1").Trim();
    }

    /// <summary>Matches the start of each capitalised word after the first, including runs like "ID" followed by a word.</summary>
    [GeneratedRegex(@"(?<!^)([A-Z][a-z]+|[A-Z]+(?![a-z]))")]
    private static partial Regex PascalCaseBoundary();
}
