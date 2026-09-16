namespace MathilensERP.Api.Common.Export;

/// <summary>
/// One named table of an export: what it is called, its column headings, and its rows.
///
/// <para>The same header-and-rows shape every single-table export already passes to
/// <see cref="ExportResultFactory"/>, given a name so that several of them can travel together. A
/// whole-shop backup is about ten of these, and each output format arranges them differently — a
/// sheet each in a workbook, a file each in a zip, a property each in a JSON object, a section each
/// in a document. Naming the unit is what lets one gathering step feed all four.</para>
/// </summary>
public sealed record ExportTable(
    /// <summary>Doubles as the sheet name, the CSV filename stem and the JSON property.</summary>
    string Name,
    IReadOnlyList<string> Headers,
    IReadOnlyList<IReadOnlyList<object?>> Rows);
