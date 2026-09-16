using MathilensERP.Application.Activity;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Drafts.Queries;

/// <summary>
/// This person's unfinished orders, newest first.
///
/// <para>Capped rather than paged. A list of drafts is a list of loose ends: a shop with more than
/// a handful has a habit to fix rather than a page to turn, and paging would make the screen imply
/// that keeping dozens is normal.</para>
/// </summary>
public sealed record ListOrderDraftsQuery : IQuery<Result<IReadOnlyList<OrderDraftSummaryDto>>>;

public sealed class ListOrderDraftsQueryHandler
    : IQueryHandler<ListOrderDraftsQuery, Result<IReadOnlyList<OrderDraftSummaryDto>>>
{
    private const int MaxDrafts = 25;

    private readonly IOrderDraftRepository _drafts;
    private readonly IActivityLogRepository _activityLog;
    private readonly ICurrentUserService _currentUser;

    public ListOrderDraftsQueryHandler(
        IOrderDraftRepository drafts,
        IActivityLogRepository activityLog,
        ICurrentUserService currentUser)
    {
        _drafts = drafts;
        _activityLog = activityLog;
        _currentUser = currentUser;
    }

    public async Task<Result<IReadOnlyList<OrderDraftSummaryDto>>> Handle(
        ListOrderDraftsQuery query, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } ownerUserId)
        {
            return Result.Failure<IReadOnlyList<OrderDraftSummaryDto>>(
                Error.Unauthorized("Auth.Required", "Sign in to see your drafts."));
        }

        // Cleared before the list is read, so an expired draft is never offered and then found to
        // be gone. A query that writes is unusual and deliberate: this application has no scheduler,
        // and the alternative is drafts that live for ever. See OrderDraftExpiry.
        await OrderDraftExpiry.SweepAsync(_drafts, _activityLog, DateTime.UtcNow, cancellationToken);

        var drafts = await _drafts.ListForOwnerAsync(ownerUserId, MaxDrafts, cancellationToken);

        // The payload is deliberately absent here: the list only needs to be readable, and sending
        // every unfinished order's full form state to render a few lines of text would make opening
        // the Orders screen heavier the more drafts somebody had abandoned.
        return drafts
            .Select(d => new OrderDraftSummaryDto(
                d.Id, d.Kind, d.CustomerId, d.Summary, d.CreatedAtUtc, d.LastModifiedAtUtc))
            .ToList();
    }
}

/// <summary>One draft, with its payload, for resuming into the form.</summary>
public sealed record GetOrderDraftQuery(Guid Id) : IQuery<Result<OrderDraftDto>>;

public sealed class GetOrderDraftQueryHandler : IQueryHandler<GetOrderDraftQuery, Result<OrderDraftDto>>
{
    private readonly IOrderDraftRepository _drafts;
    private readonly ICurrentUserService _currentUser;

    public GetOrderDraftQueryHandler(IOrderDraftRepository drafts, ICurrentUserService currentUser)
    {
        _drafts = drafts;
        _currentUser = currentUser;
    }

    public async Task<Result<OrderDraftDto>> Handle(GetOrderDraftQuery query, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } ownerUserId)
        {
            return Result.Failure<OrderDraftDto>(Error.Unauthorized("Auth.Required", "Sign in to open a draft."));
        }

        var draft = await _drafts.GetAsync(query.Id, ownerUserId, cancellationToken);
        if (draft is null)
        {
            return Result.Failure<OrderDraftDto>(
                Error.NotFound("OrderDraft.NotFound", "This draft no longer exists."));
        }

        // Checked here as well as swept on the list, because a link is not always followed from the
        // list — it can be a bookmark, a second tab left open overnight, or a back button. Opening a
        // draft that has aged out must not resurrect it by saving over the top.
        if ((draft.LastModifiedAtUtc ?? draft.CreatedAtUtc) < DateTime.UtcNow - OrderDraftExpiry.Lifetime)
        {
            return Result.Failure<OrderDraftDto>(
                Error.NotFound("OrderDraft.Expired", "This draft is more than a day old and has been discarded."));
        }

        return new OrderDraftDto(
            draft.Id, draft.Kind, draft.CustomerId, draft.Summary, draft.Payload,
            draft.CreatedAtUtc, draft.LastModifiedAtUtc);
    }
}
