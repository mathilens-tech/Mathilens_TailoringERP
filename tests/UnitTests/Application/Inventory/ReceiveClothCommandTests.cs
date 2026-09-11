using MathilensERP.Application.Inventory;
using MathilensERP.Application.Inventory.Commands.Receive;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Pricing;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Inventory;

public class ReceiveClothCommandHandlerTests
{
    private static readonly DateOnly Received = new(2026, 8, 13);

    private readonly IClothReceiptRepository _receipts = Substitute.For<IClothReceiptRepository>();
    private readonly IClothPriceRepository _clothPrices = Substitute.For<IClothPriceRepository>();

    private ReceiveClothCommandHandler Handler() => new(_receipts, _clothPrices);

    private static ReceiveClothCommand Command(Guid clothPriceId, decimal quantity = 12.5m, decimal? rate = 220m) =>
        new(clothPriceId, quantity, ClothUnit.Metres, Received, "Surat Textiles", "INV-7781", rate, null);

    [Fact]
    public async Task Handle_RecordsTheReceiptAgainstThePriceListEntry()
    {
        var clothPrice = ClothPrice.Create("CTN-14", "Cotton Blue", 180m, 260m);
        _clothPrices.GetByIdAsync(clothPrice.Id, Arg.Any<CancellationToken>()).Returns(clothPrice);
        var handler = Handler();

        var result = await handler.Handle(Command(clothPrice.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        // Code and name are copied from the catalogue, so the log still reads correctly after the
        // price-list entry is renamed or removed.
        Assert.Equal("CTN-14", result.Value.ClothCode);
        Assert.Equal("Cotton Blue", result.Value.ClothName);
        Assert.Equal(12.5m, result.Value.Quantity);
        Assert.Equal(ClothUnit.Metres, result.Value.Unit);
        _receipts.Received(1).Add(Arg.Any<ClothReceipt>());
        await _receipts.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ComputesTheTotalFromQuantityAndRate()
    {
        var clothPrice = ClothPrice.Create("CTN-14", "Cotton Blue", 180m, 260m);
        _clothPrices.GetByIdAsync(clothPrice.Id, Arg.Any<CancellationToken>()).Returns(clothPrice);

        var result = await Handler().Handle(Command(clothPrice.Id, 10m, 220m), CancellationToken.None);

        Assert.Equal(2200m, result.Value.TotalCost);
    }

    [Fact]
    public async Task Handle_WithNoRate_LeavesTheTotalUnknownRatherThanZero()
    {
        var clothPrice = ClothPrice.Create("CTN-14", "Cotton Blue", 180m, 260m);
        _clothPrices.GetByIdAsync(clothPrice.Id, Arg.Any<CancellationToken>()).Returns(clothPrice);

        // The bill often arrives after the cloth does; a total of 0 would read as "it was free".
        var result = await Handler().Handle(Command(clothPrice.Id, 10m, rate: null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.RatePerUnit);
        Assert.Null(result.Value.TotalCost);
    }

    [Fact]
    public async Task Handle_WithAnUnknownCloth_ReturnsNotFoundAndSavesNothing()
    {
        _clothPrices.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((ClothPrice?)null);

        var result = await Handler().Handle(Command(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ClothPrice.NotFound", result.Error.Code);
        _receipts.DidNotReceive().Add(Arg.Any<ClothReceipt>());
        await _receipts.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class ReceiveClothCommandValidatorTests
{
    private readonly ReceiveClothCommandValidator _validator = new();

    private static ReceiveClothCommand Valid() =>
        new(Guid.NewGuid(), 10m, ClothUnit.Metres, new DateOnly(2026, 8, 13), null, null, null, null);

    [Fact]
    public void Validate_WithTheMandatoryFields_Passes()
    {
        Assert.True(_validator.Validate(Valid()).IsValid);
    }

    [Fact]
    public void Validate_WithNoCloth_Fails()
    {
        var result = _validator.Validate(Valid() with { ClothPriceId = Guid.Empty });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(ReceiveClothCommand.ClothPriceId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_WithANonPositiveQuantity_Fails(decimal quantity)
    {
        var result = _validator.Validate(Valid() with { Quantity = quantity });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(ReceiveClothCommand.Quantity));
    }

    [Fact]
    public void Validate_WithANegativeRate_Fails()
    {
        var result = _validator.Validate(Valid() with { RatePerUnit = -1m });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WithAZeroRate_Passes()
    {
        // Free samples happen, and recording one as zero is honest.
        Assert.True((_validator.Validate(Valid() with { RatePerUnit = 0m })).IsValid);
    }

    [Fact]
    public void Validate_WithNoReceivedDate_Fails()
    {
        var result = _validator.Validate(Valid() with { ReceivedOn = default });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(ReceiveClothCommand.ReceivedOn));
    }
}
