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

public sealed class ExportBackupQueryHandler : IQueryHandler<ExportBackupQuery, Result<BackupDto>>
{
    /// <summary>
    /// The most rows any one table contributes to a backup.
    ///
    /// <para>Ten times the per-screen export cap, because this runs once when somebody asks for it
    /// rather than every time a list is filtered, and a backup that silently omitted half a shop's
    /// orders would be worse than a slow one. It is still a cap: without one, a single request
    /// would materialise the whole activity of a long-running shop into memory and hold a
    /// connection open while it did.</para>
    ///
    /// <para>When a table reaches it the result says so, and the screen tells the shop — a
    /// truncated backup that looks complete is the failure worth avoiding here.</para>
    /// </summary>
    private const int MaxRowsPerTable = 50_000;

    private readonly ICustomerRepository _customers;
    private readonly IEmployeeRepository _employees;
    private readonly IOrderRepository _orders;
    private readonly IInvoiceRepository _invoices;
    private readonly IMeasurementRepository _measurements;
    private readonly IClothPriceRepository _clothPrices;
    private readonly IClothReceiptRepository _clothReceipts;
    private readonly IWhatsAppMessageRepository _whatsAppMessages;
    private readonly ISettingRepository _settings;

    public ExportBackupQueryHandler(
        ICustomerRepository customers,
        IEmployeeRepository employees,
        IOrderRepository orders,
        IInvoiceRepository invoices,
        IMeasurementRepository measurements,
        IClothPriceRepository clothPrices,
        IClothReceiptRepository clothReceipts,
        IWhatsAppMessageRepository whatsAppMessages,
        ISettingRepository settings)
    {
        _customers = customers;
        _employees = employees;
        _orders = orders;
        _invoices = invoices;
        _measurements = measurements;
        _clothPrices = clothPrices;
        _clothReceipts = clothReceipts;
        _whatsAppMessages = whatsAppMessages;
        _settings = settings;
    }

    public async Task<Result<BackupDto>> Handle(ExportBackupQuery query, CancellationToken cancellationToken)
    {
        // Sequentially, not in parallel. These share one DbContext, which is not thread-safe — a
        // Task.WhenAll here throws "A second operation was started on this context" under exactly
        // the load a real backup creates. The wait is a few seconds, once, on a deliberate action.
        var customers = await _customers.ListAllAsync(cancellationToken);
        var employees = await _employees.ListAllAsync(cancellationToken);
        var clothPrices = await _clothPrices.ListAllAsync(cancellationToken);

        var orders = await _orders.SearchAsync(null, null, null, null, 1, MaxRowsPerTable, cancellationToken);
        var invoices = await _invoices.SearchAsync(null, null, null, null, 1, MaxRowsPerTable, cancellationToken);
        var receipts = await _clothReceipts.SearchAsync(null, null, null, null, 1, MaxRowsPerTable, cancellationToken);
        var messages = await _whatsAppMessages.SearchAsync(null, null, null, 1, MaxRowsPerTable, cancellationToken);
        var settings = await _settings.ListAsync(1, MaxRowsPerTable, cancellationToken);

        var measurements = await _measurements.ListAllAsync(MaxRowsPerTable, cancellationToken);

        // Paid amounts in one lookup for the whole set, the same way the order list and the order
        // export do — an order's balance is a billing question, and asking it per order would be
        // one query per row of the largest table in the file.
        var paidByOrder = await _invoices.GetPaidAmountsForOrdersAsync(
            orders.Items.Select(order => order.Id).ToList(), cancellationToken);

        var truncated = orders.Items.Count >= MaxRowsPerTable
            || invoices.Items.Count >= MaxRowsPerTable
            || receipts.Items.Count >= MaxRowsPerTable
            || messages.Items.Count >= MaxRowsPerTable
            || settings.Items.Count >= MaxRowsPerTable
            || measurements.Count >= MaxRowsPerTable;

        return new BackupDto(
            [.. customers.Select(customer => customer.ToDto())],
            [.. employees.Select(employee => employee.ToDto())],
            [.. orders.Items.Select(order => order.ToDto(paidByOrder.TryGetValue(order.Id, out var paid) ? paid : 0m))],
            [.. invoices.Items.Select(invoice => invoice.ToDto())],
            [.. measurements.Select(measurement => measurement.ToDto())],
            [.. clothPrices.Select(price => price.ToDto())],
            [.. receipts.Items.Select(receipt => receipt.ToDto())],
            [.. messages.Items.Select(message => message.ToDto())],
            [.. settings.Items.Select(setting => setting.ToDto())],
            truncated);
    }
}
