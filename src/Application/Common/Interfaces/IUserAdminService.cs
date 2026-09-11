using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Port for administering who can sign in and what role they hold. Kept separate from
/// <see cref="IIdentityService"/>, which is about authenticating yourself — this is about
/// granting access to other people, and only an Owner may do it.
/// </summary>
public interface IUserAdminService
{
    /// <summary>Every login, a page at a time — ordered by email so the order is stable across pages.</summary>
    Task<PagedResult<AppUserDto>> ListUsersAsync(int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>
    /// Creates a login and assigns its role.
    /// </summary>
    /// <param name="userName">
    /// What this person will sign in as. At least <see cref="UserNameRules.MinimumLength"/>
    /// characters, and unique across the system — Identity enforces the uniqueness on its own index.
    /// </param>
    /// <param name="mobileNumber">
    /// Required, and stored canonically as <c>+91XXXXXXXXXX</c> like every other number the system
    /// holds. Not unique and not an identifier: two people at one shop may share a handset, and
    /// nothing signs in by it.
    /// </param>
    Task<Result<AppUserDto>> CreateUserAsync(
        string userName,
        string email,
        string password,
        string fullName,
        string mobileNumber,
        string role,
        CancellationToken cancellationToken);

    Task<Result> SetRoleAsync(Guid userId, string role, CancellationToken cancellationToken);

    /// <summary>
    /// Changes a person's details: what they are called, what they sign in as, and how to reach them.
    ///
    /// <para>Sent whole rather than field by field, because the uniqueness rules span them — a
    /// username and an email each have to be free of every *other* account, and checking them one
    /// endpoint at a time would let two half-applied changes leave the record in a state neither
    /// caller asked for. The role is deliberately not here: it is access control, it has its own
    /// last-Owner rule, and it is guarded by a different permission.</para>
    ///
    /// <para>Changing the username changes how that person signs in. Their existing sessions are
    /// left alone — a rename is not a security event, and signing someone out mid-order to tell
    /// them their name was tidied up would be its own problem.</para>
    /// </summary>
    Task<Result> UpdateUserAsync(
        Guid userId,
        string userName,
        string email,
        string fullName,
        string mobileNumber,
        CancellationToken cancellationToken);

    /// <summary>
    /// One person's name, or null where the account has none or does not exist.
    ///
    /// Read on every <c>/users/me</c> rather than carried as a token claim, so a rename shows up on
    /// the next request instead of whenever that person's token happens to be refreshed.
    /// </summary>
    Task<string?> GetFullNameAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Resets someone who has lost their password onto a generated temporary one, and requires them
    /// to replace it the moment they sign in with it.
    ///
    /// <para>The password is generated rather than chosen by the Owner. One a person picks for
    /// somebody else is one they know, and a password set at a counter under time pressure is the
    /// same three every time. It is returned exactly once — only its hash is stored, so reopening
    /// the screen cannot show it again.</para>
    ///
    /// <para>Every refresh token that user holds is revoked at the same time. A reset is often
    /// prompted by an account being used by the wrong person, and leaving their existing sessions
    /// alive would let that carry on for as long as the tokens last.</para>
    /// </summary>
    Task<Result<TemporaryPasswordDto>> ResetPasswordAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Issues a one-time code the user redeems to choose their own password.
    ///
    /// Preferred over <see cref="ResetPasswordAsync"/>: the Owner hands the code over in person and
    /// never learns the password that gets set. The plaintext is returned exactly once, because only
    /// its hash is stored — reopening the screen cannot show it again, and nor can the database.
    ///
    /// Their existing sessions are revoked immediately, not when the code is redeemed. A reset is
    /// often prompted by an account being in the wrong hands, and waiting would leave whoever has it
    /// signed in for as long as they avoid using the code.
    /// </summary>
    Task<Result<PasswordResetCodeDto>> IssueResetCodeAsync(Guid userId, CancellationToken cancellationToken);
}

/// <param name="UserName">What they sign in as. For an account created before usernames were asked for, this is their email.</param>
/// <param name="FullName">Null for an account created before names were recorded — screens show the email instead.</param>
/// <param name="MobileNumber">Canonical <c>+91XXXXXXXXXX</c>, or null for an account created before the number was asked for.</param>
public sealed record AppUserDto(Guid Id, string UserName, string Email, string? FullName, string? MobileNumber, string? Role);

/// <summary>The plaintext code and when it stops working. Shown once and never retrievable again.</summary>
public sealed record PasswordResetCodeDto(string Code, DateTime ExpiresAtUtc);

/// <summary>
/// The temporary password an Owner reads out after a reset. Shown once and never retrievable again
/// — the account holds only its hash, exactly like any other password.
/// </summary>
public sealed record TemporaryPasswordDto(string Password);
