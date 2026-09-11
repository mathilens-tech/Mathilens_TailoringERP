using System.Security.Claims;
using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Users;
using MathilensERP.Application.Auth.Commands.ChangePassword;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Authorization;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Results;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public sealed class UsersController : ApiControllerBase
{
    private readonly IUserAdminService _userAdminService;
    private readonly IRolePermissionService _rolePermissions;
    private readonly IRoleAdminService _roleAdmin;
    private readonly IRoleCatalog _roleCatalog;
    private readonly ISender _sender;

    public UsersController(
        IUserAdminService userAdminService,
        IRolePermissionService rolePermissions,
        IRoleAdminService roleAdmin,
        IRoleCatalog roleCatalog,
        ISender sender)
    {
        _userAdminService = userAdminService;
        _rolePermissions = rolePermissions;
        _roleAdmin = roleAdmin;
        _roleCatalog = roleCatalog;
        _sender = sender;
    }

    /// <summary>
    /// The authenticated caller's identity, role and resolved permissions. The frontend uses the
    /// permission list to decide which screens and actions to offer — the server enforces the same
    /// list independently, so hiding a button is a courtesy, never the control.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<CurrentUserResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var id = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        // Through the same resolver the server enforces with, so the screens the frontend offers
        // and the calls it is actually allowed to make can never disagree.
        var permissions = await _rolePermissions.PermissionsForAsync(roles, cancellationToken);

        // Read rather than taken from a claim, so somebody renamed on the Users screen sees it on
        // their next request instead of whenever their token next happens to be refreshed.
        var fullName = await _userAdminService.GetFullNameAsync(id, cancellationToken);

        return Ok(ApiResponse<CurrentUserResponse>.Ok(new CurrentUserResponse(id, email, fullName, roles, permissions)));
    }

    /// <summary>Every login in the system with the role each one holds, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [Authorize(Policy = Permissions.UsersView)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AppUserDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var users = await _userAdminService.ListUsersAsync(page, pageSize, cancellationToken);
        return ToPagedActionResult(Result.Success(users));
    }

    /// <summary>
    /// The roles that can be assigned, so the UI never offers one the server would reject.
    /// Read from the role store rather than a fixed list — a shop's own roles belong in the
    /// dropdown alongside the four that ship with the system.
    /// </summary>
    [HttpGet("roles")]
    [Authorize(Policy = Permissions.UsersView)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<string>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Roles(CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyList<string>>.Ok(await _roleCatalog.ListRoleNamesAsync(cancellationToken)));

    /// <summary>Every role with whether it is built in and how many people hold it — the User Roles screen.</summary>
    [HttpGet("roles/details")]
    [Authorize(Policy = Permissions.UsersRoles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AppRoleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RoleDetails(CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyList<AppRoleDto>>.Ok(await _roleAdmin.ListAsync(cancellationToken)));

    /// <summary>Adds a role. It starts with no rights at all until User Rights says otherwise.</summary>
    [HttpPost("roles")]
    [Authorize(Policy = Permissions.UsersRoles)]
    [ProducesResponseType(typeof(ApiResponse<AppRoleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRole([FromBody] SaveRoleRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await _roleAdmin.CreateAsync(request.Name, cancellationToken));

    /// <summary>Renames a role, carrying its configured rights across with it.</summary>
    [HttpPut("roles/{id:guid}")]
    [Authorize(Policy = Permissions.UsersRoles)]
    [ProducesResponseType(typeof(ApiResponse<AppRoleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RenameRole(Guid id, [FromBody] SaveRoleRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await _roleAdmin.RenameAsync(id, request.Name, cancellationToken));

    /// <summary>Removes a role. Refused while anyone still holds it, and for the built-in four.</summary>
    [HttpDelete("roles/{id:guid}")]
    [Authorize(Policy = Permissions.UsersRoles)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await _roleAdmin.DeleteAsync(id, cancellationToken));

    /// <summary>Creates a login and assigns its role.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.UsersCreate)]
    [ProducesResponseType(typeof(ApiResponse<AppUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.CreateUserAsync(
            request.UserName,
            request.Email,
            request.Password,
            request.FullName,
            request.MobileNumber,
            request.Role,
            cancellationToken);

        return ToActionResult(result);
    }

    /// <summary>
    /// Changes a user's name, username, email and mobile number. Their role has its own endpoint.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.UsersEdit)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.UpdateUserAsync(
            id,
            request.UserName,
            request.Email,
            request.FullName,
            request.MobileNumber,
            cancellationToken);

        return ToActionResult(result);
    }

    /// <summary>Changes a user's role. Refused if it would remove the last Owner.</summary>
    [HttpPut("{id:guid}/role")]
    [Authorize(Policy = Permissions.UsersEdit)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetRole(Guid id, [FromBody] SetUserRoleRequest request, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.SetRoleAsync(id, request.Role, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Resets a user who has lost their password onto a generated temporary one, signs them out
    /// everywhere, and requires them to choose their own the next time they sign in.
    ///
    /// <para>Takes no body: the password is generated, not supplied. It comes back once — only its
    /// hash is stored, so calling this again issues a different one rather than repeating it.</para>
    /// </summary>
    [HttpPost("{id:guid}/password")]
    [Authorize(Policy = Permissions.UsersPassword)]
    [ProducesResponseType(typeof(ApiResponse<TemporaryPasswordDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetPassword(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.ResetPasswordAsync(id, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Every role and every screen, with what each role may currently do — the rights grid in
    /// Settings. Readable by anyone who may see the Users screen.
    /// </summary>
    [HttpGet("role-permissions")]
    [Authorize(Policy = Permissions.UsersView)]
    [ProducesResponseType(typeof(ApiResponse<RolePermissionMatrixDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RolePermissions(CancellationToken cancellationToken)
    {
        var matrix = await _rolePermissions.GetMatrixAsync(cancellationToken);
        return Ok(ApiResponse<RolePermissionMatrixDto>.Ok(matrix));
    }

    /// <summary>
    /// Replaces what one role may do. Requires Users.Manage rather than Settings.Manage: this is
    /// access control, and a Manager holding Settings.Manage must not be able to grant themselves
    /// the right to hand out access.
    /// </summary>
    /// <summary>
    /// Issues a one-time code the user redeems to choose their own password.
    ///
    /// Preferred over setting a password on their behalf: the Owner hands the code over in person
    /// and never learns what gets chosen. The plaintext comes back exactly once — only its hash is
    /// stored, so reopening this screen cannot show it again.
    /// </summary>
    [HttpPost("{id:guid}/reset-code")]
    [Authorize(Policy = Permissions.UsersPassword)]
    [ProducesResponseType(typeof(ApiResponse<PasswordResetCodeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IssueResetCode(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.IssueResetCodeAsync(id, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Changes the caller's own password.
    ///
    /// Needs no permission beyond being signed in — this is the one password action that is nobody
    /// else's business. Knowing the current password is what stands in for an Owner being present.
    /// A fresh token pair comes back so the screen they did it on keeps working; every other
    /// session ends.
    /// </summary>
    [HttpPost("me/password")]
    [ProducesResponseType(typeof(ApiResponse<AuthTokensDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangeOwnPassword([FromBody] ChangeOwnPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new ChangePasswordCommand(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), request.CurrentPassword, request.NewPassword),
            cancellationToken);

        return ToActionResult(result);
    }

    [HttpPut("role-permissions/{role}")]
    [Authorize(Policy = Permissions.UsersRights)]
    [ProducesResponseType(typeof(ApiResponse<RolePermissionsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetRolePermissions(
        string role,
        [FromBody] SetRolePermissionsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _rolePermissions.SetPermissionsAsync(role, request.Permissions, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Restores a role to its built-in permissions.</summary>
    [HttpDelete("role-permissions/{role}")]
    [Authorize(Policy = Permissions.UsersRights)]
    [ProducesResponseType(typeof(ApiResponse<RolePermissionsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetRolePermissions(string role, CancellationToken cancellationToken)
    {
        var result = await _rolePermissions.ResetPermissionsAsync(role, cancellationToken);
        return ToActionResult(result);
    }
}
