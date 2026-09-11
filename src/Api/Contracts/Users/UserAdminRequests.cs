namespace MathilensERP.Api.Contracts.Users;

/// <param name="UserName">What this person signs in as — not their email, which is only a contact detail.</param>
/// <param name="Email">How to reach them. Still unique, and still what a password reset is confirmed against.</param>
/// <param name="Password">Checked against the policy by Identity, not here.</param>
/// <param name="FullName">What to call them on screen.</param>
/// <param name="MobileNumber">Required. Ten digits; stored canonically as +91XXXXXXXXXX.</param>
/// <param name="Role">Must already exist in the role store — including one the shop added itself.</param>
public sealed record CreateUserRequest(
    string UserName,
    string Email,
    string Password,
    string FullName,
    string MobileNumber,
    string Role);

public sealed record SetUserRoleRequest(string Role);

/// <summary>
/// Editing a person's details. Sent whole — see IUserAdminService.UpdateUserAsync for why the
/// uniqueness rules make one request safer than four.
/// </summary>
/// <param name="UserName">What they sign in as. Changing it changes how they get in.</param>
/// <param name="Email">Still unique across accounts, and still what a password reset is confirmed against.</param>
/// <param name="FullName">What to call them on screen.</param>
/// <param name="MobileNumber">Ten digits; stored canonically as +91XXXXXXXXXX.</param>
public sealed record UpdateUserRequest(
    string UserName,
    string Email,
    string FullName,
    string MobileNumber);

/// <summary>The complete set the role should hold — sent whole, so unticking is expressible.</summary>
public sealed record SetRolePermissionsRequest(IReadOnlyList<string> Permissions);

/// <summary>Changing your own password: proving you know the current one is what stands in for an Owner being present.</summary>
public sealed record ChangeOwnPasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>Adding or renaming a role. A role is only its name here — its rights live on User Rights.</summary>
public sealed record SaveRoleRequest(string Name);
