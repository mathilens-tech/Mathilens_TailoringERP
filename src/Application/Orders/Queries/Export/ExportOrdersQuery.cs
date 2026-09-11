using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.Export;

/// <summary>
/// The whole filtered operational list, bounded for a file download rather than an interactive page.
/// </summary>
public sealed record ExportOrdersQuery(
    Guid? CustomerId,
    OrderStatus? Status,
    string? SearchTerm,
    string? GarmentType) : IQuery<Result<IReadOnlyList<OrderDto>>>;
