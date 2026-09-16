using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Inventory;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Pricing;
using MathilensERP.Application.Settings;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Backup.Queries.ExportBackup;

/// <summary>
/// Everything the shop holds, in one read, for the Settings › Backup download.
///
/// <para>No filters and no paging, unlike every other export in this codebase: a backup that
/// answered a search term would be a backup of part of the shop, which is the one thing it must not
/// be. What bounds it instead is a row cap per table, applied so a single download cannot pull an
/// unbounded result set into memory.</para>
/// </summary>
public sealed record ExportBackupQuery : IQuery<Result<BackupDto>>;

/// <summary>
/// The shop's data, table by table.
///
/// <para>Existing DTOs throughout rather than a shape of its own, so a field added to an order or a
/// customer appears in the backup without anybody remembering to add it here — a backup that
/// quietly stops covering a new column is worse than one that never covered it.</para>
///
/// <para><b>The activity log is deliberately not here.</b> It records who opened which screen, runs
/// to orders of magnitude more rows than everything else combined, and is an audit trail of use
/// rather than anything the shop owns. Including it would make every backup mostly log.</para>
/// </summary>
public sealed record BackupDto(
    IReadOnlyList<CustomerDto> Customers,
    IReadOnlyList<EmployeeDto> Employees,
    IReadOnlyList<OrderDto> Orders,
    IReadOnlyList<InvoiceDto> Invoices,
    IReadOnlyList<MeasurementDto> Measurements,
    IReadOnlyList<ClothPriceDto> ClothPrices,
    IReadOnlyList<ClothReceiptDto> ClothReceipts,
    IReadOnlyList<WhatsAppMessageDto> WhatsAppMessages,
    IReadOnlyList<SettingDto> Settings,
    /// <summary>True when any table hit the cap, so the screen can say the file is incomplete.</summary>
    bool IsTruncated);
