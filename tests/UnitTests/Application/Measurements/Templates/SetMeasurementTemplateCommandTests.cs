using System.Text.Json;
using MathilensERP.Application.Measurements.Templates;
using MathilensERP.Application.Measurements.Templates.Commands;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Settings;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Templates;

public class SetMeasurementTemplateCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithNoStoredTemplate_AddsOneHoldingThePointsInOrder()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var handler = new SetMeasurementTemplateCommandHandler(repository);

        var result = await handler.Handle(
            new SetMeasurementTemplateCommand(GarmentTypes.Trousers, [MeasurementPointDto.Number("Length"), MeasurementPointDto.Number("Waist")]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal([MeasurementPointDto.Number("Length"), MeasurementPointDto.Number("Waist")], result.Value.Points);
        repository.Received(1).Add(Arg.Is<Setting>(s =>
            s != null &&
            s.Key == MeasurementTemplateKeys.For(GarmentTypes.Trousers) &&
            s.Value == JsonSerializer.Serialize(new[] { MeasurementPointDto.Number("Length"), MeasurementPointDto.Number("Waist") })));
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAStoredTemplate_ReplacesItRatherThanAddingASecond()
    {
        var existing = Setting.Create(MeasurementTemplateKeys.For(GarmentTypes.Shirt), "[\"Neck\"]");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(MeasurementTemplateKeys.For(GarmentTypes.Shirt), Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new SetMeasurementTemplateCommandHandler(repository);

        await handler.Handle(new SetMeasurementTemplateCommand(GarmentTypes.Shirt, [MeasurementPointDto.Number("Chest"), MeasurementPointDto.Number("Neck")]), CancellationToken.None);

        Assert.Equal(JsonSerializer.Serialize(new[] { MeasurementPointDto.Number("Chest"), MeasurementPointDto.Number("Neck") }), existing.Value);
        repository.DidNotReceive().Add(Arg.Any<Setting>());
    }

    [Fact]
    public async Task Handle_TrimsPointNames()
    {
        var repository = Substitute.For<ISettingRepository>();
        var handler = new SetMeasurementTemplateCommandHandler(repository);

        var result = await handler.Handle(
            new SetMeasurementTemplateCommand(GarmentTypes.Blouse, [MeasurementPointDto.Number("  Waist  ")]), CancellationToken.None);

        // Values are stored keyed by point name, so a stray space would key them differently.
        Assert.Equal([MeasurementPointDto.Number("Waist")], result.Value.Points);
    }
}

public class ResetMeasurementTemplateCommandHandlerTests
{
    [Fact]
    public async Task Handle_RemovesTheStoredTemplateAndReturnsTheDefault()
    {
        var existing = Setting.Create(MeasurementTemplateKeys.For(GarmentTypes.Dress), "[\"Length\"]");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(MeasurementTemplateKeys.For(GarmentTypes.Dress), Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new ResetMeasurementTemplateCommandHandler(repository);

        var result = await handler.Handle(new ResetMeasurementTemplateCommand(GarmentTypes.Dress), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(MeasurementTemplateDefaults.For(GarmentTypes.Dress), result.Value.Points);
        Assert.False(result.Value.IsCustomised);
        repository.Received(1).Remove(existing);
    }

    [Fact]
    public async Task Handle_WhenAlreadyOnTheDefault_SucceedsWithoutSaving()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var handler = new ResetMeasurementTemplateCommandHandler(repository);

        var result = await handler.Handle(new ResetMeasurementTemplateCommand(GarmentTypes.Suit), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

public class SetMeasurementTemplateCommandValidatorTests
{
    private readonly SetMeasurementTemplateCommandValidator _validator = new();

    [Fact]
    public void Validate_WithPoints_Passes()
    {
        var result = _validator.Validate(new SetMeasurementTemplateCommand(GarmentTypes.Shirt, [MeasurementPointDto.Number("Neck"), MeasurementPointDto.Number("Chest")]));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithNoPoints_Fails()
    {
        var result = _validator.Validate(new SetMeasurementTemplateCommand(GarmentTypes.Shirt, []));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WithABlankPointName_Fails()
    {
        var result = _validator.Validate(new SetMeasurementTemplateCommand(GarmentTypes.Shirt, [MeasurementPointDto.Number("Neck"), MeasurementPointDto.Number(" ")]));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WithDuplicatePointNames_Fails()
    {
        // Values are stored keyed by point name, so two "Waist" rows would collapse into one.
        var result = _validator.Validate(new SetMeasurementTemplateCommand(GarmentTypes.Shirt, [MeasurementPointDto.Number("Waist"), MeasurementPointDto.Number("waist")]));

        Assert.False(result.IsValid);
    }
}
