using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Drafts.Commands;

/// <summary>
/// Discards a draft — by hand, or because the order it was becoming has now been created.
///
/// <para>A hard delete, unlike almost everything else in this system. Soft-deleting a draft would
/// keep a half-typed order forever for no benefit: nothing references it, nothing reports on it,
/// and it was never a record of anything that happened. The audit interest is in the order that
/// resulted, which is kept.</para>
/// </summary>
public sealed record DeleteOrderDraftCommand(Guid Id) : ICommand<Result>;

public sealed class DeleteOrderDraftCommandHandler : ICommandHandler<DeleteOrderDraftCommand, Result>
{
    private readonly IOrderDraftRepository _drafts;
    private readonly ICurrentUserService _currentUser;

    public DeleteOrderDraftCommandHandler(IOrderDraftRepository drafts, ICurrentUserService currentUser)
    {
        _drafts = drafts;
        _currentUser = currentUser;
    }

    public async Task<Result> Handle(DeleteOrderDraftCommand command, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } ownerUserId)
        {
            return Result.Failure(Error.Unauthorized("Auth.Required", "Sign in to discard a draft."));
        }

        var draft = await _drafts.GetAsync(command.Id, ownerUserId, cancellationToken);
        if (draft is null)
        {
            // Already gone counts as discarded. The order screen deletes its draft the moment the
            // order is created, and a retry of that call must not be an error the counter sees.
            return Result.Success();
        }

        _drafts.Remove(draft);
        await _drafts.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
