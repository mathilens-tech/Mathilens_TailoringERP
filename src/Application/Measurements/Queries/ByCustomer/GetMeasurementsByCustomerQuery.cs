using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.ByCustomer;

/// <summary>Every garment-type measurement recorded for a customer — unpaginated: bounded by the number of <c>GarmentType</c> values, never large.</summary>
public sealed record GetMeasurementsByCustomerQuery(Guid CustomerId) : IQuery<Result<IReadOnlyList<MeasurementDto>>>;
