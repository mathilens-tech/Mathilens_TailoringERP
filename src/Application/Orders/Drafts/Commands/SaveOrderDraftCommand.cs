using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Drafts.Commands;

/// <summary>
/// Creates a draft, or replaces the one already identified.
///
/// <para>One command for both because autosave cannot know which it is doing. The screen holds a
/// draft id from the first save onwards and sends it every time after; a null id is the first save
/// of a form that has just started. Two commands would have every caller deciding which to send
/// based on state it is already sending.</para>
/// </summary>
public sealed record SaveOrderDraftCommand(
    Guid? Id,
    string Kind,
    Guid? CustomerId,
    string Summary,
    string Payload) : ICommand<Result<OrderDraftDto>>;

public sealed class SaveOrderDraftCommandHandler : ICommandHandler<SaveOrderDraftCommand, Result<OrderDraftDto>>
{
    private readonly IOrderDraftRepository _drafts;
    private readonly ICurrentUserService _currentUser;

    public SaveOrderDraftCommandHandler(IOrderDraftRepository drafts, ICurrentUserService currentUser)
    {
        _drafts = drafts;
        _currentUser = currentUser;
    }

    public async Task<Result<OrderDraftDto>> Handle(SaveOrderDraftCommand command, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } ownerUserId)
        {
            return Result.Failure<OrderDraftDto>(
                Error.Unauthorized("Auth.Required", "Sign in to save a draft."));
        }

        OrderDraft draft;
        if (command.Id is { } id)
        {
            var existing = await _drafts.GetAsync(id, ownerUserId, cancellationToken);
            if (existing is null)
            {
                // Not found, or somebody else's — the repository does not distinguish, and neither
                // should this. A draft deleted in another tab while this one autosaves lands here,
                // and the honest answer is that the thing being updated is gone.
                return Result.Failure<OrderDraftDto>(
                    Error.NotFound("OrderDraft.NotFound", "This draft no longer exists."));
            }

            existing.Replace(command.Kind, command.CustomerId, command.Summary, command.Payload);
            draft = existing;
        }
        else
        {
            draft = OrderDraft.Create(ownerUserId, command.Kind, command.CustomerId, command.Summary, command.Payload);
            _drafts.Add(draft);
        }

        await _drafts.SaveChangesAsync(cancellationToken);

        return new OrderDraftDto(
            draft.Id, draft.Kind, draft.CustomerId, draft.Summary, draft.Payload,
            draft.CreatedAtUtc, draft.LastModifiedAtUtc);
    }
}
