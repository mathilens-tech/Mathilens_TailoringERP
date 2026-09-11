using MathilensERP.Application.Inventory;
using MathilensERP.Application.Inventory.Queries.Stock;
using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Inventory;

/// <summary>
/// The stock screen's arithmetic. What counts as consumption is decided in the repository query;
/// these cover the folding of per-unit rows into one line per cloth, which is where a metres
/// figure could otherwise silently absorb a rolls figure.
/// </summary>
public class GetStockSummaryQueryHandlerTests
{
    private static readonly DateOnly Received = new(2026, 8, 10);

    private readonly IClothReceiptRepository _receipts = Substitute.For<IClothReceiptRepository>();

    private GetStockSummaryQueryHandler Handler(params ClothStockRow[] rows)
    {
        _receipts.GetStockSummaryAsync(Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ClothStockRow>(rows, 1, 20, rows.Length));
        return new GetStockSummaryQueryHandler(_receipts);
    }

    [Fact]
    public async Task Handle_SubtractsWhatOrdersUsedFromWhatWasReceived()
    {
        var clothId = Guid.NewGuid();
        var handler = Handler(new ClothStockRow(clothId, "CTN-14", "Cotton Blue", ClothUnit.Metres, 100m, 30m, Received));

        var result = await handler.Handle(new GetStockSummaryQuery(null, 1, 20), CancellationToken.None);

        var quantity = Assert.Single(result.Value.Items).Quantities.Single();
        Assert.Equal(100m, quantity.Received);
        Assert.Equal(30m, quantity.Used);
        Assert.Equal(70m, quantity.Available);
    }

    [Fact]
    public async Task Handle_KeepsUnitsApartRatherThanAddingThem()
    {
        var clothId = Guid.NewGuid();
        var handler = Handler(
            new ClothStockRow(clothId, "CTN-14", "Cotton Blue", ClothUnit.Metres, 100m, 30m, Received),
            new ClothStockRow(clothId, "CTN-14", "Cotton Blue", ClothUnit.Rolls, 4m, 1m, Received));

        var result = await handler.Handle(new GetStockSummaryQuery(null, 1, 20), CancellationToken.None);

        // One line for the cloth, two figures — 70 metres and 3 rolls, never "73".
        var row = Assert.Single(result.Value.Items);
        Assert.Equal(2, row.Quantities.Count);
        Assert.Equal(70m, row.Quantities.Single(q => q.Unit == ClothUnit.Metres).Available);
        Assert.Equal(3m, row.Quantities.Single(q => q.Unit == ClothUnit.Rolls).Available);
    }

    [Fact]
    public async Task Handle_ShowsAShortfallAsNegativeRatherThanHidingIt()
    {
        var clothId = Guid.NewGuid();
        var handler = Handler(new ClothStockRow(clothId, "CTN-14", "Cotton Blue", ClothUnit.Metres, 5m, 12m, Received));

        var result = await handler.Handle(new GetStockSummaryQuery(null, 1, 20), CancellationToken.None);

        // More issued than ever arrived is a real bookkeeping mistake; clamping it at zero would
        // hide the only evidence of it.
        Assert.Equal(-7m, Assert.Single(result.Value.Items).Quantities.Single().Available);
    }

    [Fact]
    public async Task Handle_OrdersTheLinesByClothCode()
    {
        var handler = Handler(
            new ClothStockRow(Guid.NewGuid(), "SLK-02", "Silk", ClothUnit.Metres, 10m, 0m, Received),
            new ClothStockRow(Guid.NewGuid(), "CTN-14", "Cotton Blue", ClothUnit.Metres, 10m, 0m, Received));

        var result = await handler.Handle(new GetStockSummaryQuery(null, 1, 20), CancellationToken.None);

        Assert.Equal(["CTN-14", "SLK-02"], result.Value.Items.Select(i => i.ClothCode));
    }
}
