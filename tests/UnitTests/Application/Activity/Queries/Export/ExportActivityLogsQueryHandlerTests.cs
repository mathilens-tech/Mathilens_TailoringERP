using MathilensERP.Application.Activity;
using MathilensERP.Application.Activity.Queries.Export;
using MathilensERP.Domain.Activity;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Activity.Queries.Export;

public class ExportActivityLogsQueryHandlerTests
{
    private readonly IActivityLogRepository _repository = Substitute.For<IActivityLogRepository>();

    private static ActivityLog Entry(string screen = "Orders", string? changes = null) =>
        ActivityLog.Record(
            userId: Guid.NewGuid(),
            userName: "admin@mathilens.local",
            screen: screen,
            action: "Update Order",
            requestName: "UpdateOrderCommand",
            occurredAtUtc: new DateTime(2026, 9, 16, 15, 36, 0, DateTimeKind.Utc),
            description: "Order updated",
            changes: changes);

    [Fact]
    public async Task Handle_AsksForOneBoundedPageRatherThanTheScreenful()
    {
        _repository.SearchAsync(null, null, null, null, 1, 5000, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ActivityLog>([Entry()], 1, 5000, 1));
        var handler = new ExportActivityLogsQueryHandler(_repository);

        await handler.Handle(new ExportActivityLogsQuery(null, null, null, null), CancellationToken.None);

        // Page 1 of 5,000, not the interactive page size. An export that silently returned the
        // twenty rows somebody happened to be looking at would be the kind of wrong that is only
        // noticed once the file has been filed.
        await _repository.Received(1).SearchAsync(null, null, null, null, 1, 5000, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_PassesEveryFilterThroughUnchanged()
    {
        var from = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 9, 16, 23, 59, 59, DateTimeKind.Utc);
        var userId = Guid.NewGuid();
        _repository.SearchAsync(from, to, userId, "Billing", 1, 5000, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ActivityLog>([Entry("Billing")], 1, 5000, 1));
        var handler = new ExportActivityLogsQueryHandler(_repository);

        var result = await handler.Handle(
            new ExportActivityLogsQuery(from, to, userId, "Billing"), CancellationToken.None);

        // The file has to be the screen it was taken from. Dropping a filter here would hand
        // somebody the whole trail under a heading that says one day of it.
        Assert.Equal("Billing", Assert.Single(result.Value).Screen);
        await _repository.Received(1).SearchAsync(from, to, userId, "Billing", 1, 5000, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ReadsTheRecordedChanges()
    {
        const string json = """[{"entity":"Order","field":"Notes","from":"old","to":"new"}]""";
        _repository.SearchAsync(null, null, null, null, 1, 5000, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ActivityLog>([Entry(changes: json)], 1, 5000, 1));
        var handler = new ExportActivityLogsQueryHandler(_repository);

        var result = await handler.Handle(new ExportActivityLogsQuery(null, null, null, null), CancellationToken.None);

        var change = Assert.Single(Assert.Single(result.Value).Changes);
        Assert.Equal("Notes", change.Field);
        Assert.Equal("old", change.From);
        Assert.Equal("new", change.To);
    }

    [Fact]
    public async Task Handle_KeepsAnEntryWhoseChangesCannotBeRead()
    {
        _repository.SearchAsync(null, null, null, null, 1, 5000, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ActivityLog>([Entry(changes: "{ not json")], 1, 5000, 1));
        var handler = new ExportActivityLogsQueryHandler(_repository);

        var result = await handler.Handle(new ExportActivityLogsQuery(null, null, null, null), CancellationToken.None);

        // One unreadable value costs that entry its detail, not the caller their download. An export
        // that threw on a single malformed row would be unavailable exactly when the trail is being
        // examined because something went wrong.
        var entry = Assert.Single(result.Value);
        Assert.Empty(entry.Changes);
        Assert.Equal("Order updated", entry.Description);
    }
}
