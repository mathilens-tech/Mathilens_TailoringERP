using MathilensERP.Application.Backup.Queries.ExportBackup;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Turns the gathered DTOs into the named, flat tables every backup format is written from.
///
/// <para>In the API layer, beside the writers, for the reason the architecture gives: flattening a
/// nested order into a row is a transport concern, and Application keeps dealing in records. It is
/// also why this is shaped once here rather than four times — the JSON, the workbook, the zip and
/// the document all read the same tables, so they cannot disagree about what a backup contains.</para>
/// </summary>
public static class BackupTables
{
    public static IReadOnlyList<ExportTable> From(BackupDto backup) =>
    [
        new ExportTable(
            "Customers",
            ["Id", "Full name", "Phone number", "Email", "Address", "Notes", "Gender", "Religion", "Date of birth", "Wedding date", "Created"],
            [.. backup.Customers.Select(c => new object?[]
            {
                c.Id, c.FullName, c.PhoneNumber, c.Email, c.Address, c.Notes,
                c.Gender?.ToString(), c.Religion?.ToString(), c.DateOfBirth, c.WeddingDate, c.CreatedAtUtc,
            })]),

        new ExportTable(
            "Employees",
            ["Id", "Employee code", "Full name", "Job title", "Phone number", "Email", "Joining date", "Employment type", "Last working date", "Active", "Created"],
            [.. backup.Employees.Select(e => new object?[]
            {
                e.Id, e.EmployeeCode, e.FullName, e.JobTitle, e.PhoneNumber, e.Email,
                e.JoiningDate, e.EmploymentType.ToString(), e.LastWorkingDate, e.IsActive, e.CreatedAtUtc,
            })]),

        new ExportTable(
            "Orders",
            ["Id", "Order number", "Customer id", "Employee id", "Status", "Due", "Delivered", "Order value", "Paid", "Balance", "Items", "Notes", "Created"],
            [.. backup.Orders.Select(o => new object?[]
            {
                o.Id, o.OrderNumber, o.CustomerId, o.EmployeeId, o.Status.ToString(),
                o.DueAtUtc, o.DeliveredAtUtc, o.TotalAmount, o.AmountPaid, o.BalanceAmount,
                // Flattened into one cell rather than given a table of their own. A backup is read
                // per order far more often than per line, and a separate items table would need the
                // reader to join it back by id in a spreadsheet to answer "what was this order for".
                string.Join(", ", o.Items.Select(item => $"{item.GarmentType} × {item.Quantity} @ {item.UnitPrice}")),
                o.Notes, o.CreatedAtUtc,
            })]),

        new ExportTable(
            "Invoices",
            ["Id", "Invoice number", "Order id", "Customer id", "Subtotal", "Tax", "Discount", "Total", "Paid", "Balance", "Status", "Payments", "Created"],
            [.. backup.Invoices.Select(i => new object?[]
            {
                i.Id, i.InvoiceNumber, i.OrderId, i.CustomerId, i.Subtotal, i.TaxAmount, i.DiscountAmount,
                i.TotalAmount, i.AmountPaid, i.RemainingBalance, i.Status.ToString(),
                string.Join(", ", i.Payments.Select(p => $"{p.Amount} {p.Method} on {p.CreatedAtUtc:yyyy-MM-dd}")),
                i.CreatedAtUtc,
            })]),

        new ExportTable(
            "Measurements",
            ["Id", "Customer id", "Garment type", "Values", "Notes", "Created"],
            [.. backup.Measurements.Select(m => new object?[]
            {
                m.Id, m.CustomerId, m.GarmentType,
                // "Chest: 40; Side pocket: Yes". The points a shop asks for are its own and differ
                // per garment, so there is no fixed set of columns to spread them across — one cell
                // holding the pairs keeps every garment's measurements in a table of one shape.
                string.Join("; ", m.Values.Select(pair => $"{pair.Key}: {pair.Value}")),
                m.Notes, m.CreatedAtUtc,
            })]),

        new ExportTable(
            "Fabric details",
            ["Id", "Cloth code", "Cloth name", "Cost price", "Selling price", "Created"],
            [.. backup.ClothPrices.Select(p => new object?[]
            {
                p.Id, p.ClothCode, p.ClothName, p.CostPrice, p.SellingPrice, p.CreatedAtUtc,
            })]),

        new ExportTable(
            "Inventory receipts",
            ["Id", "Cloth code", "Cloth name", "Quantity", "Unit", "Received on", "Supplier", "Invoice number", "Rate per unit", "Total cost", "Notes", "Created"],
            [.. backup.ClothReceipts.Select(r => new object?[]
            {
                r.Id, r.ClothCode, r.ClothName, r.Quantity, r.Unit.ToString(), r.ReceivedOn,
                r.SupplierName, r.InvoiceNumber, r.RatePerUnit, r.TotalCost, r.Notes, r.CreatedAtUtc,
            })]),

        new ExportTable(
            "WhatsApp messages",
            ["Id", "Customer id", "Order id", "Type", "Status", "Content", "Failure reason", "Created"],
            [.. backup.WhatsAppMessages.Select(m => new object?[]
            {
                m.Id, m.CustomerId, m.OrderId, m.MessageType.ToString(), m.Status.ToString(),
                m.Content, m.FailureReason, m.CreatedAtUtc,
            })]),

        new ExportTable(
            "Settings",
            ["Key", "Value", "Created", "Last modified"],
            [.. backup.Settings.Select(s => new object?[] { s.Key, s.Value, s.CreatedAtUtc, s.LastModifiedAtUtc })]),
    ];
}
