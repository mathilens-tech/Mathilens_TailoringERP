using MathilensERP.Api.Contracts.Common;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Common;

/// <summary>
/// A controller's only job is to translate an HTTP request into a command/query, dispatch it
/// via the mediator, and translate the <see cref="Result"/> back into an HTTP response
/// (01_ARCHITECTURE.md § 9.1 API Layer) — this base class is that translation, written once.
/// </summary>
public abstract class ApiControllerBase : ControllerBase
{
    protected IActionResult ToActionResult<T>(Result<T> result) =>
        result.IsSuccess ? Ok(ApiResponse<T>.Ok(result.Value)) : ToErrorResult(result.Error);

    protected IActionResult ToActionResult(Result result) =>
        result.IsSuccess ? NoContent() : ToErrorResult(result.Error);

    /// <summary>Maps a paginated query result to the standard envelope with a pagination <c>meta</c> (00_MASTER_SPEC.md § 8.3).</summary>
    protected IActionResult ToPagedActionResult<T>(Result<PagedResult<T>> result) =>
        result.IsSuccess
            ? Ok(ApiResponse<IReadOnlyList<T>>.Ok(result.Value.Items, PaginationMeta.From(result.Value)))
            : ToErrorResult(result.Error);

    private IActionResult ToErrorResult(Error error)
    {
        var details = error.Details?
            .Select(d => new ApiFieldError(d.Field, d.Message))
            .ToList();

        var body = ApiErrorResponse.From(error.Code, error.Message, details);

        return error.Type switch
        {
            ErrorType.Validation => BadRequest(body),
            ErrorType.NotFound => NotFound(body),
            ErrorType.Conflict => Conflict(body),
            ErrorType.Unauthorized => Unauthorized(body),
            ErrorType.Forbidden => StatusCode(StatusCodes.Status403Forbidden, body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
