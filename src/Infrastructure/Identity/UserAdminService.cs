using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Implements <see cref="IUserAdminService"/> over ASP.NET Core Identity.
///
/// Exactly one role per user: a shop hands out "front desk" or "tailor", not a combination, and
/// allowing several would make what someone can do a question nobody can answer at a glance.
/// </summary>
public sealed class UserAdminService : IUserAdminService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly Persistence.ApplicationDbContext _dbContext;
    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;

    public UserAdminService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        Persistence.ApplicationDbContext dbContext,
        IPasswordHasher<ApplicationUser> passwordHasher)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<PagedResult<AppUserDto>> ListUsersAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _userManager.Users.OrderBy(u => u.Email);

        var totalCount = await query.CountAsync(cancellationToken);

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // One role lookup per user on the page only — previously this ran for every user in the
        // system on every load, which is what made paging worth doing here at all.
        var items = new List<AppUserDto>(users.Count);
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            items.Add(new AppUserDto(
                user.Id,
                user.UserName ?? string.Empty,
                user.Email ?? string.Empty,
                user.FullName,
                user.PhoneNumber,
                roles.FirstOrDefault()));
        }

        return new PagedResult<AppUserDto>(items, page, pageSize, totalCount);
    }

    public async Task<Result<AppUserDto>> CreateUserAsync(
        string userName,
        string email,
        string password,
        string fullName,
        string mobileNumber,
        string role,
        CancellationToken cancellationToken)
    {
        // Against the role store rather than a fixed list: a shop can add its own roles on the
        // User Roles screen, and one created five minutes ago is as assignable as Front Desk.
        if (!await _roleManager.RoleExistsAsync(role))
        {
            return Result.Failure<AppUserDto>(Error.Validation("Users.UnknownRole", $"'{role}' is not a role in this system."));
        }

        var login = userName.Trim();

        // The one username rule Identity has no option for. Its own checks — allowed characters and
        // uniqueness — run inside CreateAsync below and report themselves through the same details
        // list, so this only covers the length.
        if (login.Length < UserNameRules.MinimumLength)
        {
            return Result.Failure<AppUserDto>(Error.Validation(
                "Users.UserNameTooShort",
                UserNameRules.LengthMessage,
                [new FieldError("userName", UserNameRules.LengthMessage)]));
        }

        // Asked before CreateAsync so the answer names the username, rather than arriving as
        // Identity's "User name 'asha' is already taken" among the password rules.
        if (await _userManager.FindByNameAsync(login) is not null)
        {
            return Result.Failure<AppUserDto>(Error.Conflict(
                "Users.UserNameAlreadyTaken", $"The username '{login}' is already taken."));
        }

        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return Result.Failure<AppUserDto>(Error.Conflict("Users.EmailAlreadyRegistered", "An account with this email already exists."));
        }

        if (MobileNumberError(mobileNumber) is { } mobileError)
        {
            return Result.Failure<AppUserDto>(mobileError);
        }

        // Canonical +91XXXXXXXXXX, the same form customers and employees are stored in — a number
        // held four ways is a number nothing can match on.
        var mobile = IndianPhoneNumber.Normalize(mobileNumber);
        var name = fullName.Trim();

        var user = new ApplicationUser { UserName = login, Email = email, FullName = name, PhoneNumber = mobile };
        var created = await _userManager.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            var details = created.Errors.Select(e => new FieldError(FieldFor(e.Code), e.Description)).ToList();
            return Result.Failure<AppUserDto>(Error.Validation("Users.CreateFailed", "This account could not be created.", details));
        }

        await _userManager.AddToRoleAsync(user, role);

        return Result.Success(new AppUserDto(user.Id, login, email, name, mobile, role));
    }

    /// <summary>
    /// The reason a mobile number will not do, or null when it will.
    ///
    /// Required, and a real Indian mobile number — the same rule the customer and employee forms
    /// apply, worded the same way, because a number the counter may enter against a customer and
    /// may not enter against a user would be an inconsistency nobody could explain.
    /// </summary>
    private static Error? MobileNumberError(string mobileNumber)
    {
        if (string.IsNullOrWhiteSpace(mobileNumber))
        {
            return Validation("Mobile number is required.");
        }

        if (!IndianPhoneNumber.IsValid(mobileNumber))
        {
            // Ten digits and still wrong means the series digit is the fault; telling someone to
            // count again when they already have ten sends them looking in the wrong place.
            return Validation(IndianPhoneNumber.TryNormalize(mobileNumber, out _)
                ? "Mobile number must start with 6, 7, 8 or 9."
                : "Mobile number must be 10 digits.");
        }

        return null;

        static Error Validation(string message) =>
            Error.Validation("Users.InvalidMobileNumber", message, [new FieldError("mobileNumber", message)]);
    }

    /// <summary>
    /// Which box on the form an Identity failure belongs against.
    ///
    /// Everything Identity rejected used to be reported under the password, which was true while a
    /// password was the only thing it could reject. Now that it also validates a username, a name
    /// with a space in it would explain itself underneath the password field.
    /// </summary>
    private static string FieldFor(string identityErrorCode) =>
        identityErrorCode.Contains("UserName", StringComparison.Ordinal) ? "userName"
        : identityErrorCode.Contains("Email", StringComparison.Ordinal) ? "email"
        : "password";

    public async Task<Result> UpdateUserAsync(
        Guid userId,
        string userName,
        string email,
        string fullName,
        string mobileNumber,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure(Error.NotFound("Users.NotFound", $"No user was found with id '{userId}'."));
        }

        var login = userName.Trim();
        if (login.Length < UserNameRules.MinimumLength)
        {
            return Result.Failure(Error.Validation(
                "Users.UserNameTooShort",
                UserNameRules.LengthMessage,
                [new FieldError("userName", UserNameRules.LengthMessage)]));
        }

        // Against every *other* account: a person keeping their own username is not a clash, and
        // comparing by id rather than by name is what tells the two apart.
        var byName = await _userManager.FindByNameAsync(login);
        if (byName is not null && byName.Id != userId)
        {
            return Result.Failure(Error.Conflict(
                "Users.UserNameAlreadyTaken", $"The username '{login}' is already taken."));
        }

        var byEmail = await _userManager.FindByEmailAsync(email);
        if (byEmail is not null && byEmail.Id != userId)
        {
            return Result.Failure(Error.Conflict(
                "Users.EmailAlreadyRegistered", "An account with this email already exists."));
        }

        if (MobileNumberError(mobileNumber) is { } mobileError)
        {
            return Result.Failure(mobileError);
        }

        // Through Identity's own setters rather than by assigning the properties: these also rewrite
        // NormalizedUserName and NormalizedEmail, which are the columns the unique indexes and every
        // lookup actually use. Setting the plain properties alone would leave an account findable
        // only under its old name.
        if (!string.Equals(user.UserName, login, StringComparison.Ordinal))
        {
            var renamed = await _userManager.SetUserNameAsync(user, login);
            if (!renamed.Succeeded)
            {
                return Result.Failure(FailureFrom(renamed, "This username could not be saved."));
            }
        }

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var readdressed = await _userManager.SetEmailAsync(user, email);
            if (!readdressed.Succeeded)
            {
                return Result.Failure(FailureFrom(readdressed, "This email could not be saved."));
            }
        }

        user.FullName = fullName.Trim();
        user.PhoneNumber = IndianPhoneNumber.Normalize(mobileNumber);

        var updated = await _userManager.UpdateAsync(user);
        if (!updated.Succeeded)
        {
            return Result.Failure(FailureFrom(updated, "These details could not be saved."));
        }

        return Result.Success();
    }

    /// <summary>Turns an Identity failure into a validation error with each message under its own field.</summary>
    private static Error FailureFrom(IdentityResult result, string message) =>
        Error.Validation(
            "Users.UpdateFailed",
            message,
            result.Errors.Select(e => new FieldError(FieldFor(e.Code), e.Description)).ToList());

    public async Task<string?> GetFullNameAsync(Guid userId, CancellationToken cancellationToken) =>
        await _userManager.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<Result> SetRoleAsync(Guid userId, string role, CancellationToken cancellationToken)
    {
        if (!await _roleManager.RoleExistsAsync(role))
        {
            return Result.Failure(Error.Validation("Users.UnknownRole", $"'{role}' is not a role in this system."));
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure(Error.NotFound("Users.NotFound", $"No user was found with id '{userId}'."));
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        // Demoting the last Owner would leave nobody able to grant access to anyone, including
        // themselves — an unrecoverable state short of database surgery.
        if (currentRoles.Contains(AppRoles.Owner) && role != AppRoles.Owner)
        {
            var owners = await _userManager.GetUsersInRoleAsync(AppRoles.Owner);
            if (owners.Count <= 1)
            {
                return Result.Failure(Error.Conflict(
                    "Users.LastOwner", "This is the only Owner. Make someone else an Owner first."));
            }
        }

        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, role);

        return Result.Success();
    }

    public async Task<Result<TemporaryPasswordDto>> ResetPasswordAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure<TemporaryPasswordDto>(Error.NotFound("Users.NotFound", $"No user was found with id '{userId}'."));
        }

        // Built to satisfy the configured policy, so this cannot fail for a reason the Owner could
        // do anything about — see TemporaryPasswords.Generate.
        var temporaryPassword = TemporaryPasswords.Generate();

        // Generate-and-redeem rather than RemovePassword/AddPassword: it is one atomic operation
        // that leaves the account with a password throughout, and it runs the configured policy.
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var reset = await _userManager.ResetPasswordAsync(user, token, temporaryPassword);
        if (!reset.Succeeded)
        {
            var details = reset.Errors.Select(e => new FieldError("newPassword", e.Description)).ToList();
            return Result.Failure<TemporaryPasswordDto>(
                Error.Validation("Users.ResetPasswordFailed", "This password could not be set.", details));
        }

        // What makes this temporary rather than just new: the next sign-in with it is allowed
        // through, and then the app requires a password of the user's own before anything else.
        await _userManager.SetAuthenticationTokenAsync(
            user,
            PasswordResetCodes.Provider,
            TemporaryPasswords.MustChangeTokenName,
            TemporaryPasswords.MustChangeTokenValue);

        // A reset is often prompted by the account being in the wrong hands. Their existing
        // sessions must not outlive it, so every refresh token they hold is revoked, and the
        // security stamp is rolled so nothing minted from the old credentials survives.
        await _userManager.UpdateSecurityStampAsync(user);

        var now = DateTime.UtcNow;
        var activeTokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var activeToken in activeTokens)
        {
            activeToken.Revoke(now);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Lockout from earlier failed attempts would otherwise persist past the fix.
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        // Returned once. Only the hash is stored, so this is the single moment the plaintext exists
        // anywhere the Owner can read it.
        return Result.Success(new TemporaryPasswordDto(temporaryPassword));
    }

    public async Task<Result<PasswordResetCodeDto>> IssueResetCodeAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure<PasswordResetCodeDto>(Error.NotFound("Users.NotFound", $"No user was found with id '{userId}'."));
        }

        var code = PasswordResetCodes.Generate();
        var expiresAtUtc = DateTime.UtcNow.Add(PasswordResetCodes.Lifetime);

        // Setting replaces any code already outstanding, so issuing a second one silently retires
        // the first. Two live codes for one account would double the guessing surface for no gain.
        await _userManager.SetAuthenticationTokenAsync(
            user,
            PasswordResetCodes.Provider,
            PasswordResetCodes.CodeHashName,
            PasswordResetCodes.Hash(_passwordHasher, user, code));

        await _userManager.SetAuthenticationTokenAsync(
            user,
            PasswordResetCodes.Provider,
            PasswordResetCodes.ExpiresName,
            expiresAtUtc.ToString("O"));

        // Sessions end now, not when the code is redeemed. Waiting would leave whoever currently
        // holds the account signed in for as long as they simply avoid using the code.
        await _userManager.UpdateSecurityStampAsync(user);

        var now = DateTime.UtcNow;
        var activeTokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var activeToken in activeTokens)
        {
            activeToken.Revoke(now);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // A locked-out account cannot sign in even with the new password, so the lockout goes too.
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        return Result.Success(new PasswordResetCodeDto(code, expiresAtUtc));
    }
}
