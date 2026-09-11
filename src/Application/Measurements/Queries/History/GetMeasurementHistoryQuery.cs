using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.History;

public sealed record GetMeasurementHistoryQuery(Guid MeasurementId, int Page, int PageSize) : IQuery<Result<PagedResult<MeasurementHistoryDto>>>;
