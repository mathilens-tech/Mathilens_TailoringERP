using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Reports;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.Revenue;

public sealed record GetRevenueReportQuery(DateTime FromUtc, DateTime ToUtc) : IQuery<Result<RevenueReportDto>>;
