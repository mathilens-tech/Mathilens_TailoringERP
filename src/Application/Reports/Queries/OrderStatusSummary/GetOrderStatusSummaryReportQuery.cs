using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Reports;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OrderStatusSummary;

public sealed record GetOrderStatusSummaryReportQuery(DateTime FromUtc, DateTime ToUtc) : IQuery<Result<OrderStatusSummaryReportDto>>;
