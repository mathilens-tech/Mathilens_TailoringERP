using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.MeasurementBackup;

public sealed class GetMeasurementBackupReportQueryHandler
    : IQueryHandler<GetMeasurementBackupReportQuery, Result<MeasurementBackupReportDto>>
{
    // Far past any tailoring shop's book, so the backup is "everything" in practice while still
    // being a bounded read rather than an unbounded one that a runaway row count could hang on.
    private const int MeasurementLimit = 500_000;

    // The same key and fallback the public invoice reads its shop name from, so the backup is headed
    // with whatever the shop set there rather than a name of its own.
    private const string ShopNameKey = "Shop.Name";
    private const string DefaultShopName = "Mathilens";

    private readonly ICustomerRepository _customerRepository;
    private readonly IMeasurementRepository _measurementRepository;
    private readonly ISettingRepository _settingRepository;

    public GetMeasurementBackupReportQueryHandler(
        ICustomerRepository customerRepository,
        IMeasurementRepository measurementRepository,
        ISettingRepository settingRepository)
    {
        _customerRepository = customerRepository;
        _measurementRepository = measurementRepository;
        _settingRepository = settingRepository;
    }

    public async Task<Result<MeasurementBackupReportDto>> Handle(GetMeasurementBackupReportQuery query, CancellationToken cancellationToken)
    {
        var customers = await _customerRepository.ListAllAsync(cancellationToken);
        var measurements = await _measurementRepository.ListAllAsync(MeasurementLimit, cancellationToken);
        var shopNameSetting = await _settingRepository.GetByKeyAsync(ShopNameKey, cancellationToken);
        var shopName = string.IsNullOrWhiteSpace(shopNameSetting?.Value) ? DefaultShopName : shopNameSetting.Value;

        // Grouped once, so each customer is a dictionary lookup rather than a scan of every
        // measurement. A customer with none simply is not in the map.
        var byCustomer = measurements
            .GroupBy(m => m.CustomerId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var rows = customers
            .OrderBy(c => c.FullName, StringComparer.OrdinalIgnoreCase)
            .Select(c => new CustomerMeasurementsDto(
                c.FullName,
                c.PhoneNumber,
                (byCustomer.TryGetValue(c.Id, out var ms) ? ms : [])
                    .OrderBy(m => m.GarmentType, StringComparer.OrdinalIgnoreCase)
                    .Select(m => new GarmentMeasurementsDto(
                        m.GarmentType,
                        m.Notes,
                        // Ordered by label so the same garment reads the same way on every reprint,
                        // and so two prints of one backup can be compared line for line. ToString on
                        // the value does the Yes/No, the word, or the trimmed figure.
                        m.Values
                            .OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                            .Select(kv => new MeasurementEntryDto(kv.Key, kv.Value.ToString()))
                            .ToList()))
                    .ToList()))
            .ToList();

        return Result.Success(new MeasurementBackupReportDto(shopName, rows));
    }
}
