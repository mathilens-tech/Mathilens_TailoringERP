using System.Text.Json;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Queries;

public sealed class GetMeasurementTemplatesQueryHandler
    : IQueryHandler<GetMeasurementTemplatesQuery, Result<IReadOnlyList<MeasurementTemplateDto>>>
{
    private readonly ISettingRepository _settingRepository;

    public GetMeasurementTemplatesQueryHandler(ISettingRepository settingRepository)
    {
        _settingRepository = settingRepository;
    }

    public async Task<Result<IReadOnlyList<MeasurementTemplateDto>>> Handle(
        GetMeasurementTemplatesQuery query,
        CancellationToken cancellationToken)
    {
        // One query for the whole family rather than one per garment type — this is read on every
        // New Order screen, so it should cost a single round trip.
        var stored = await _settingRepository.ListByKeyPrefixAsync(MeasurementTemplateKeys.Prefix, cancellationToken);
        var storedByKey = stored.ToDictionary(s => s.Key, s => s.Value, StringComparer.Ordinal);

        // One per garment the shop actually stitches, rather than one per value of a fixed enum:
        // a shop that has added Chudidhar needs a template for it, and one that has removed Blazer
        // should not be offered a template for a garment it never books.
        var garmentTypes = await GarmentCatalogKeys.ListAsync(_settingRepository, cancellationToken);

        var templates = garmentTypes
            .Select(garmentType =>
            {
                var points = storedByKey.TryGetValue(MeasurementTemplateKeys.For(garmentType), out var json)
                    ? Parse(json)
                    : null;

                // A stored row that no longer parses (hand-edited in the database, say) falls back
                // to the default rather than leaving that garment type unmeasurable.
                return points is { Count: > 0 }
                    ? new MeasurementTemplateDto(garmentType, points, IsCustomised: true)
                    : new MeasurementTemplateDto(garmentType, MeasurementTemplateDefaults.For(garmentType), IsCustomised: false);
            })
            .ToList();

        return Result.Success<IReadOnlyList<MeasurementTemplateDto>>(templates);
    }

    private static IReadOnlyList<MeasurementPointDto>? Parse(string json)
    {
        try
        {
            // MeasurementPointDto's converter reads both the original array-of-names format and
            // the typed one, so a template saved before points had types still loads.
            return JsonSerializer.Deserialize<List<MeasurementPointDto>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
