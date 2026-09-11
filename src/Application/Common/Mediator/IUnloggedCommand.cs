namespace MathilensERP.Application.Common.Mediator;

/// <summary>
/// Marks a command that must not appear in the activity trail.
///
/// The trail records what a person did in the shop, and it is only readable if that is all it
/// records. A command the browser issues on its own — refreshing an access token every quarter of
/// an hour, say — is not something anyone did, and at a few entries per user per hour it buries
/// the entries that matter. This is the same reasoning that already keeps queries out of the log
/// (see <see cref="Behaviors.ActivityLogBehavior{TRequest,TResponse}"/>); some automatic work just
/// happens to be spelled as a command.
///
/// Deliberately opt-*out*: commands are logged unless their author says otherwise, so a command
/// added later is still covered the day it is written, and every exemption is visible on the type
/// it applies to rather than in a list somewhere else. Reach for it only for machine-initiated
/// commands — a sign-in is automatic-looking but genuinely auditable, and stays logged.
/// </summary>
public interface IUnloggedCommand
{
}
