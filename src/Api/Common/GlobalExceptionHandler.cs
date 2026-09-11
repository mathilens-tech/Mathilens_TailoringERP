using MathilensERP.Api.Contracts.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Common;

/// <summary>
/// Catches every unhandled exception, logs it with full context, and translates it into the
/// standard error envelope — no unhandled exception ever reaches a client as a raw stack
/// trace (01_ARCHITECTURE.md § 13 Exception Strategy). Expected business outcomes never reach
/// here; they are modeled as <c>Result</c> failures and handled by <see cref="ApiControllerBase"/>.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        _logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path}",
            httpContext.Request.Method,
            httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/json";

        var body = ApiErrorResponse.From("INTERNAL_SERVER_ERROR", "An unexpected error occurred.");

        await httpContext.Response.WriteAsJsonAsync(body, cancellationToken);

        return true;
    }
}
