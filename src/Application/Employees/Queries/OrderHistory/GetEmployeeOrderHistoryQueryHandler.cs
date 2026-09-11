using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.OrderHistory;

public sealed class GetEmployeeOrderHistoryQueryHandler
    : IQueryHandler<GetEmployeeOrderHistoryQuery, Result<PagedResult<EmployeeOrderDto>>>
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly IOrderRepository _orderRepository;

    public GetEmployeeOrderHistoryQueryHandler(IEmployeeRepository employeeRepository, IOrderRepository orderRepository)
    {
        _employeeRepository = employeeRepository;
        _orderRepository = orderRepository;
    }

    public async Task<Result<PagedResult<EmployeeOrderDto>>> Handle(
        GetEmployeeOrderHistoryQuery query,
        CancellationToken cancellationToken)
    {
        // An unknown employee is a 404 rather than an empty list — "this person has no orders" and
        // "this person does not exist" are different answers, and the screen says so differently.
        var employee = await _employeeRepository.GetByIdAsync(query.EmployeeId, cancellationToken);
        if (employee is null)
        {
            return Result.Failure<PagedResult<EmployeeOrderDto>>(
                Error.NotFound("Employee.NotFound", $"No employee was found with id '{query.EmployeeId}'."));
        }

        var page = await _orderRepository.SearchByEmployeeAsync(query.EmployeeId, query.Page, query.PageSize, cancellationToken);

        var items = page.Items
            .Select(row => new EmployeeOrderDto(
                row.Order.Id,
                row.CustomerName,
                row.Order.Status.ToString(),
                row.Order.Items.Count(i => !i.IsDeleted),
                row.Order.CreatedAtUtc,
                row.Order.DueAtUtc,
                row.Order.WorkStartedAtUtc,
                row.Order.WorkCompletedAtUtc,
                row.Order.DeliveredAtUtc))
            .ToList();

        return new PagedResult<EmployeeOrderDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
