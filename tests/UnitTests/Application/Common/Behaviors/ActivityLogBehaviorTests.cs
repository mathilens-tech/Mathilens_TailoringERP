using System.Text.Json;
using MathilensERP.Application.Activity;
using MathilensERP.Application.Auth.Commands.Login;
using MathilensERP.Application.Auth.Commands.RefreshAccessToken;
using MathilensERP.Application.Common.Behaviors;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Application.Customers.Queries.Search;
using MathilensERP.Domain.Activity;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Common.Behaviors;

public class ActivityLogBehaviorTests
{
    private readonly IActivityLogRepository _repository = Substitute.For<IActivityLogRepository>();
    private readonly ICurrentUserService _currentUserService = Substitute.For<ICurrentUserService>();
    private readonly IEntityChangeCollector _entityChangeCollector = Substitute.For<IEntityChangeCollector>();

    private static CreateCustomerCommand Command() => new("Asha Rao", "+91 98765 43210", null, null, null);

    private ActivityLogBehavior<TRequest, TResponse> Behavior<TRequest, TResponse>()
        where TResponse : Result =>
        new(_repository, _currentUserService, _entityChangeCollector, NullLogger<ActivityLogBehavior<TRequest, TResponse>>.Instance);

    [Fact]
    public async Task Handle_WithASuccessfulCommand_RecordsWhoDidWhat()
    {
        var userId = Guid.NewGuid();
        _currentUserService.UserId.Returns(userId);
        _currentUserService.UserName.Returns("asha@shop.example");
        var behavior = Behavior<CreateCustomerCommand, Result<CustomerDto>>();

        await behavior.Handle(
            Command(),
            () => Task.FromResult(Result.Success(new CustomerDto(
                Guid.NewGuid(), "Asha Rao", "+91 98765 43210", null, null, null, null, null, null, null, DateTime.UtcNow))),
            CancellationToken.None);

        await _repository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(a =>
                a.UserId == userId
                && a.UserName == "asha@shop.example"
                && a.Screen == "Customers"
                && a.Action == "Create Customer"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAFailedCommand_RecordsNothing()
    {
        var behavior = Behavior<CreateCustomerCommand, Result<CustomerDto>>();

        await behavior.Handle(
            Command(),
            () => Task.FromResult(Result.Failure<CustomerDto>(Error.Validation("VALIDATION_ERROR", "Nope."))),
            CancellationToken.None);

        // A refused command changed nothing, so logging it would describe an action that never happened.
        await _repository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAQuery_RecordsNothing()
    {
        var behavior = Behavior<SearchCustomersQuery, Result<PagedResult<CustomerDto>>>();

        await behavior.Handle(
            new SearchCustomersQuery(null, null, 1, 20),
            () => Task.FromResult(Result.Success(new PagedResult<CustomerDto>([], 1, 20, 0))),
            CancellationToken.None);

        await _repository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAnUnloggedCommand_RecordsNothing()
    {
        // The browser redeems a refresh token on its own whenever the access token lapses. Logging
        // it filled the trail with entries no person performed, drowning the ones that matter.
        var behavior = Behavior<RefreshAccessTokenCommand, Result<AuthTokensDto>>();

        await behavior.Handle(
            new RefreshAccessTokenCommand("a-refresh-token"),
            () => Task.FromResult(Result.Success(new AuthTokensDto("access", "refresh", DateTime.UtcNow.AddMinutes(15)))),
            CancellationToken.None);

        await _repository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithNobodySignedIn_RecordsNothing()
    {
        // Signing in happens before there is anyone to attribute it to, so these rows read as
        // "System" — which is precisely what the trail is not for. It answers "who did this", and
        // a row that cannot name anybody only crowds out the ones that can.
        var behavior = Behavior<LoginCommand, Result<AuthTokensDto>>();

        await behavior.Handle(
            new LoginCommand("asha@shop.example", "Passw0rd123"),
            () => Task.FromResult(Result.Success(new AuthTokensDto("access", "refresh", DateTime.UtcNow.AddMinutes(15)))),
            CancellationToken.None);

        await _repository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenRecordingFails_StillReturnsTheCommandsResult()
    {
        _currentUserService.UserId.Returns(Guid.NewGuid());
        _repository.AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("audit table unavailable"));
        var behavior = Behavior<CreateCustomerCommand, Result<CustomerDto>>();

        var expected = Result.Success(new CustomerDto(
            Guid.NewGuid(), "Asha Rao", "+91 98765 43210", null, null, null, null, null, null, null, DateTime.UtcNow));

        // The command already committed — reporting an error now would tempt the user to repeat work
        // that actually succeeded.
        var result = await behavior.Handle(Command(), () => Task.FromResult(expected), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_WithFieldChanges_RecordsWhatTheyChangedFromAndTo()
    {
        _currentUserService.UserId.Returns(Guid.NewGuid());
        _entityChangeCollector.Drain().Returns([new EntityChange("Customer", "Phone Number", "98765 43210", "91234 56789")]);
        var behavior = Behavior<CreateCustomerCommand, Result<CustomerDto>>();

        ActivityLog? recorded = null;
        await _repository.AddAsync(Arg.Do<ActivityLog>(a => recorded = a), Arg.Any<CancellationToken>());

        await behavior.Handle(
            Command(),
            () => Task.FromResult(Result.Success(new CustomerDto(
                Guid.NewGuid(), "Asha Rao", "+91 98765 43210", null, null, null, null, null, null, null, DateTime.UtcNow))),
            CancellationToken.None);

        // Stored as JSON so the screen can lay the two values out itself rather than parsing a sentence.
        var changes = JsonSerializer.Deserialize<List<EntityChange>>(
            recorded?.Changes ?? "[]", new JsonSerializerOptions(JsonSerializerDefaults.Web));

        var change = Assert.Single(changes!);
        Assert.Equal("Phone Number", change.Field);
        Assert.Equal("98765 43210", change.From);
        Assert.Equal("91234 56789", change.To);
    }

    [Fact]
    public async Task Handle_WithAFailedCommand_StillDrainsTheChanges()
    {
        var behavior = Behavior<CreateCustomerCommand, Result<CustomerDto>>();

        await behavior.Handle(
            Command(),
            () => Task.FromResult(Result.Failure<CustomerDto>(Error.Validation("VALIDATION_ERROR", "Nope."))),
            CancellationToken.None);

        // Anything left in the collector would be picked up by whatever ran next on this request and
        // attributed to it — an audit trail blaming the wrong action is worse than one missing a line.
        _entityChangeCollector.Received(1).Drain();
    }
}
