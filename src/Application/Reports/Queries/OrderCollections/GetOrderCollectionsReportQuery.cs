using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Reports;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OrderCollections;

public sealed record GetOrderCollectionsReportQuery(DateTime FromUtc, DateTime ToUtc) : IQuery<Result<OrderCollectionsReportDto>>;
