using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.MeasurementBackup;

/// <summary>
/// Every customer with their measurements, for the whole-shop printable backup. No parameters and
/// no date range: a measurement is the latest truth whenever it was taken, so the backup is of
/// everything on file, exactly as the measurement list screen has no range either.
/// </summary>
public sealed record GetMeasurementBackupReportQuery : IQuery<Result<MeasurementBackupReportDto>>;
