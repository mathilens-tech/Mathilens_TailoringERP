using System.Text.Json;
using MathilensERP.Application.Activity;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Activity;
using MathilensERP.Shared.Results;
using Microsoft.Extensions.Logging;

namespace MathilensERP.Application.Common.Behaviors;

/// <summary>
/// Records every successful command in the activity trail. Sitting in the pipeline rather than in
/// the handlers means no handler has to remember to log, and a command added later is covered the
/// day it is written.
///
/// Only commands, and only successful ones: queries would swamp the log with reads nobody audits,
/// and a command that returned a validation failure changed nothing, so logging it would describe
/// an action that never happened. Commands marked <see cref="IUnloggedCommand"/> are skipped for
/// the same swamping reason — they are issued by the browser, not by a person.
/// </summary>
public sealed class ActivityLogBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TResponse : Result
{
    /// <summary>Computed once per closed generic rather than per request — the answer cannot change.</summary>
    private static readonly bool IsCommand = typeof(TRequest).GetInterfaces()
        .Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(ICommand<>));

    private static readonly bool IsExempt = typeof(IUnloggedCommand).IsAssignableFrom(typeof(TRequest));

    private static readonly JsonSerializerOptions ChangeJson = new(JsonSerializerDefaults.Web);

    private readonly IActivityLogRepository _activityLogRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly IEntityChangeCollector _entityChangeCollector;
    private readonly ILogger<ActivityLogBehavior<TRequest, TResponse>> _logger;

    public ActivityLogBehavior(
        IActivityLogRepository activityLogRepository,
        ICurrentUserService currentUserService,
        IEntityChangeCollector entityChangeCollector,
        ILogger<ActivityLogBehavior<TRequest, TResponse>> logger)
    {
        _activityLogRepository = activityLogRepository;
        _currentUserService = currentUserService;
        _entityChangeCollector = entityChangeCollector;
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var response = await next();

        // Drained even when nothing will be written, so a skipped or failed command cannot leave
        // its changes behind to be attributed to whatever runs next on this request.
        var changes = _entityChangeCollector.Drain();

        // Nothing unattended is recorded. A row attributed to "System" is the app talking to
        // itself — a startup backfill, a token being renewed — and the trail exists to answer
        // "who did this", which those rows cannot. They only crowd out the ones that can.
        if (!IsCommand || IsExempt || response.IsFailure || _currentUserService.UserId is null)
        {
            return response;
        }

        try
        {
            var entry = ActivityLog.Record(
                _currentUserService.UserId,
                _currentUserService.UserName,
                ActivityDescriptor.ScreenFor(typeof(TRequest)),
                ActivityDescriptor.ActionFor(typeof(TRequest)),
                typeof(TRequest).Name,
                DateTime.UtcNow,
                ActivityDescriptionBuilder.Describe(request),
                changes.Count == 0 ? null : JsonSerializer.Serialize(changes, ChangeJson));

            await _activityLogRepository.AddAsync(entry, cancellationToken);
        }
        catch (Exception ex)
        {
            // The command has already committed. Failing the caller now would report an error for
            // work that actually succeeded, and would tempt them to repeat it — so a broken audit
            // trail is surfaced in the logs instead of being pushed onto the user.
            _logger.LogError(ex, "Failed to record activity for {Request}.", typeof(TRequest).Name);
        }

        return response;
    }
}
