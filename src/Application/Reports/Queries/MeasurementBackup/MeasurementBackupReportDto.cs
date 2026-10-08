namespace MathilensERP.Application.Reports.Queries.MeasurementBackup;

/// <summary>
/// Every customer and the measurements on file for them, for the printable backup
/// (01_ARCHITECTURE.md § 20 Reporting Strategy). Customers come ordered by name, which is the order
/// the printed index reads in; a customer with nothing measured is still listed, so the document is
/// the whole customer book and not only the measured part of it.
/// </summary>
public sealed record MeasurementBackupReportDto(string ShopName, IReadOnlyList<CustomerMeasurementsDto> Customers);

public sealed record CustomerMeasurementsDto(
    string FullName,
    string PhoneNumber,
    IReadOnlyList<GarmentMeasurementsDto> Garments);

public sealed record GarmentMeasurementsDto(
    string GarmentType,
    string? Notes,
    IReadOnlyList<MeasurementEntryDto> Entries);

/// <summary>One point as it reads on the page: what was asked, and what was answered.</summary>
public sealed record MeasurementEntryDto(string Label, string Value);
