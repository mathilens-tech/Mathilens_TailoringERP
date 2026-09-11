using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.OrderHistory;

/// <summary>Every order assigned to one employee, newest first — the work history on their view screen.</summary>
public sealed record GetEmployeeOrderHistoryQuery(Guid EmployeeId, int Page, int PageSize)
    : IQuery<Result<PagedResult<EmployeeOrderDto>>>;

/// <summary>
/// One order as it matters to the person who worked it.
/// </summary>
/// <param name="WorkStartedAtUtc">When it moved to In Progress — null if they have not begun.</param>
/// <param name="WorkCompletedAtUtc">
/// When it moved to Ready For Delivery. Distinct from <paramref name="DeliveredAtUtc"/>: finishing
/// the garment is the tailor's end of the job, collection is the customer's.
/// </param>
public sealed record EmployeeOrderDto(
    Guid OrderId,
    string CustomerName,
    string Status,
    int ItemCount,
    DateTime CreatedAtUtc,
    DateTime DueAtUtc,
    DateTime? WorkStartedAtUtc,
    DateTime? WorkCompletedAtUtc,
    DateTime? DeliveredAtUtc);
