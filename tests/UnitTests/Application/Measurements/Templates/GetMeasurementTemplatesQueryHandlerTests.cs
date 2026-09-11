using System.Text.Json;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Templates;
using MathilensERP.Application.Measurements.Templates.Queries;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Settings;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Measurements.Templates;

public class GetMeasurementTemplatesQueryHandlerTests
{
    /// <summary>
    /// Templates and the garment list come from the same store under different prefixes, so the
    /// substitute has to answer both — an unstubbed garment prefix returns nothing, which the
    /// handler correctly reads as "this shop has chosen no list" and falls back to the shipped one.
    /// </summary>
    private static ISettingRepository RepositoryReturning(Setting[] templates, Setting[]? garments = null)
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.ListByKeyPrefixAsync(MeasurementTemplateKeys.Prefix, Arg.Any<CancellationToken>())
            .Returns(templates);
        repository.ListByKeyPrefixAsync(GarmentCatalogKeys.Prefix, Arg.Any<CancellationToken>())
            .Returns(garments ?? []);
        return repository;
    }

    private static ISettingRepository RepositoryReturning(params Setting[] templates) => RepositoryReturning(templates, null);

    [Fact]
    public async Task Handle_WithNothingConfigured_ReturnsADefaultForEveryGarmentType()
    {
        var handler = new GetMeasurementTemplatesQueryHandler(RepositoryReturning());

        var result = await handler.Handle(new GetMeasurementTemplatesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(GarmentTypes.WellKnown.Count, result.Value.Count);
        // Every garment type is measurable out of the box — previously only Shirt and Trousers were.
        Assert.All(result.Value, t => Assert.NotEmpty(t.Points));
        Assert.All(result.Value, t => Assert.False(t.IsCustomised));
    }

    /// <summary>
    /// A garment the shop added itself gets a template row, empty until somebody fills it in — the
    /// New Order screen has nowhere to put measurements for it otherwise.
    /// </summary>
    [Fact]
    public async Task Handle_WithAShopChosenGarmentList_ReturnsOnePerGarmentOnThatList()
    {
        var garments = new[]
        {
            Setting.Create(GarmentCatalogKeys.For(GarmentTypes.Shirt), "Shirt"),
            Setting.Create(GarmentCatalogKeys.For("Chudidhar"), "Chudidhar"),
        };
        var handler = new GetMeasurementTemplatesQueryHandler(RepositoryReturning([], garments));

        var result = await handler.Handle(new GetMeasurementTemplatesQuery(), CancellationToken.None);

        Assert.Equal(["Shirt", "Chudidhar"], result.Value.Select(t => t.GarmentType));
        Assert.NotEmpty(result.Value.Single(t => t.GarmentType == "Shirt").Points);
        Assert.Empty(result.Value.Single(t => t.GarmentType == "Chudidhar").Points);
    }

    [Fact]
    public async Task Handle_WithAStoredTemplate_PrefersItAndKeepsItsOrder()
    {
        var stored = Setting.Create(MeasurementTemplateKeys.For(GarmentTypes.Trousers), JsonSerializer.Serialize(new[] { "Length", "Waist" }));
        var handler = new GetMeasurementTemplatesQueryHandler(RepositoryReturning(stored));

        var result = await handler.Handle(new GetMeasurementTemplatesQuery(), CancellationToken.None);

        var trousers = result.Value.Single(t => t.GarmentType == GarmentTypes.Trousers);
        Assert.Equal([MeasurementPointDto.Number("Length"), MeasurementPointDto.Number("Waist")], trousers.Points);
        Assert.True(trousers.IsCustomised);

        // Configuring one garment type leaves the others on their defaults.
        var shirt = result.Value.Single(t => t.GarmentType == GarmentTypes.Shirt);
        Assert.False(shirt.IsCustomised);
        Assert.Equal(MeasurementTemplateDefaults.For(GarmentTypes.Shirt), shirt.Points);
    }

    [Theory]
    [InlineData("not json at all")]
    [InlineData("[]")]
    public async Task Handle_WithAnUnusableStoredTemplate_FallsBackToTheDefault(string value)
    {
        // A row hand-edited in the database must not leave that garment type unmeasurable.
        var stored = Setting.Create(MeasurementTemplateKeys.For(GarmentTypes.Kurta), value);
        var handler = new GetMeasurementTemplatesQueryHandler(RepositoryReturning(stored));

        var result = await handler.Handle(new GetMeasurementTemplatesQuery(), CancellationToken.None);

        var kurta = result.Value.Single(t => t.GarmentType == GarmentTypes.Kurta);
        Assert.Equal(MeasurementTemplateDefaults.For(GarmentTypes.Kurta), kurta.Points);
        Assert.False(kurta.IsCustomised);
    }
}
