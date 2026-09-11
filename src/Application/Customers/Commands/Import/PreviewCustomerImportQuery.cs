using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Import;

/// <summary>
/// Dry-runs an upload (FR-04). A query, not a command: it writes nothing and must not appear in
/// the activity log, where it would read as an import that happened.
/// </summary>
public sealed record PreviewCustomerImportQuery(IReadOnlyList<CustomerImportRow> Rows)
    : IQuery<Result<CustomerImportPreviewDto>>;
