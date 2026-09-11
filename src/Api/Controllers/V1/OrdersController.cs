using MathilensERP.Api.Common;
using MathilensERP.Api.Common.Export;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Orders;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.AddItem;
using MathilensERP.Application.Orders.Commands.AssignEmployee;
using MathilensERP.Application.Orders.Commands.Create;
using MathilensERP.Application.Orders.Commands.Delete;
using MathilensERP.Application.Orders.Commands.RemoveItem;
using MathilensERP.Application.Orders.Commands.SetItemFabric;
using MathilensERP.Application.Orders.Commands.TransitionStatus;
using MathilensERP.Application.Orders.Commands.Update;
using MathilensERP.Application.Orders.Commands.UpdateItem;
using MathilensERP.Application.Orders.Queries.GetById;
using MathilensERP.Application.Orders.Queries.Export;
using MathilensERP.Application.Orders.Queries.PreviousForCustomer;
using MathilensERP.Application.Orders.Queries.Search;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Tailoring order endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md §§ 10.7-10.8, 10.11). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/orders")]
[Authorize(Policy = Permissions.OrdersView)]
public sealed class OrdersController : ApiControllerBase
{
    private readonly ISender _sender;

    public OrdersController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// Downloads the filtered order list as a spreadsheet or PDF.
    ///
    /// This is deliberately a separate query from <see cref="Search"/>: normal interactive
    /// requests remain capped at 100 rows, while an export is bounded independently at 5,000.
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] Guid? customerId,
        [FromQuery] OrderStatus? status,
        [FromQuery] string? search,
        [FromQuery] string? garmentType,
        [FromQuery] ExportFormat format = ExportFormat.Xlsx,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ExportOrdersQuery(customerId, status, search, garmentType), cancellationToken);
        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        return ExportResultFactory.Create(
            format,
            "Orders",
            "orders",
            ["Order number", "Status", "Due", "Delivered", "Order value", "Paid", "Balance", "Items", "Notes"],
            result.Value.Select(order => new object?[]
            {
                order.OrderNumber,
                order.Status.ToString(),
                order.DueAtUtc,
                order.DeliveredAtUtc,
                order.TotalAmount,
                order.AmountPaid,
                order.BalanceAmount,
                string.Join(", ", order.Items.Select(item => $"{item.GarmentType} × {item.Quantity}")),
                order.Notes,
            }).ToList());
    }

    /// <summary>Creates a new order with its initial garment items (and, optionally, their fabric details).</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.OrdersCreate)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var items = request.Items
            .Select(i => new CreateOrderItemInput(
                i.GarmentType,
                i.Quantity,
                i.UnitPrice,
                i.Fabric is null
                    ? null
                    : new CreateOrderItemFabricInput(
                        i.Fabric.FabricType, i.Fabric.Source, i.Fabric.Color, i.Fabric.Quantity,
                        i.Fabric.ClothCode, i.Fabric.Unit)))
            .ToList();

        var command = new CreateOrderCommand(
            request.CustomerId, request.EmployeeId, request.DueAtUtc, items, request.Notes, request.IsFabricSale);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Updates an open order's header details — customer, assigned employee, due date and notes.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.OrdersEdit)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateOrderCommand(id, request.CustomerId, request.EmployeeId, request.DueAtUtc, request.Notes);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Soft-deletes an order. Refused with 409 once the order has been invoiced.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.OrdersDelete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new DeleteOrderCommand(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single order, with its items and their fabric details, by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOrderByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// This customer's other orders, newest first — matched on their phone number, so history
    /// entered under a duplicate customer record still appears.
    /// </summary>
    [HttpGet("{id:guid}/previous")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OrderDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PreviousOrders(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPreviousOrdersQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Searches orders by customer, status and/or free text, paginated (00_MASTER_SPEC.md § 8.3).
    ///
    /// <paramref name="search"/> matches the order number, the customer's name or their phone
    /// number — whichever of the three the caller happens to have been given.
    ///
    /// <paramref name="garmentType"/> keeps only orders with an item for that garment, which is how
    /// Settings › Garments finds out whether one is still in use before offering to remove it.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OrderDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] Guid? customerId,
        [FromQuery] OrderStatus? status,
        [FromQuery] string? search,
        [FromQuery] string? garmentType,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new SearchOrdersQuery(customerId, status, search, garmentType, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>Adds a garment item to an existing (not yet delivered/cancelled) order.</summary>
    [HttpPost("{id:guid}/items")]
    [Authorize(Policy = Permissions.OrdersEdit)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddOrderItemRequest request, CancellationToken cancellationToken)
    {
        var command = new AddOrderItemCommand(id, request.GarmentType, request.Quantity, request.UnitPrice);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Updates a garment item's type, quantity and price on an open order. Its fabric details are unaffected.</summary>
    [HttpPut("{id:guid}/items/{itemId:guid}")]
    [Authorize(Policy = Permissions.OrdersEdit)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateItem(Guid id, Guid itemId, [FromBody] UpdateOrderItemRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateOrderItemCommand(id, itemId, request.GarmentType, request.Quantity, request.UnitPrice);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Removes a garment item from an open order. An order must keep at least one item.</summary>
    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [Authorize(Policy = Permissions.OrdersEdit)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RemoveOrderItemCommand(id, itemId), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Sets (or replaces) the fabric details for one of an order's items.</summary>
    [HttpPut("{id:guid}/items/{itemId:guid}/fabric")]
    [Authorize(Policy = Permissions.OrdersEdit)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetItemFabric(Guid id, Guid itemId, [FromBody] SetOrderItemFabricRequest request, CancellationToken cancellationToken)
    {
        var command = new SetOrderItemFabricCommand(id, itemId, request.FabricType, request.Source, request.Color, request.Quantity);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Advances an order's status (02_DATABASE.md § 10.7 — an enforced lifecycle; invalid transitions return 409).
    /// Delivering requires a delivery date, and is refused with 409 while any amount is still outstanding on the order.
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = Permissions.OrdersStatus)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] TransitionOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new TransitionOrderStatusCommand(id, request.TargetStatus, request.DeliveredAtUtc), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Assigns (or reassigns) the employee responsible for an order.</summary>
    [HttpPut("{id:guid}/employee")]
    [Authorize(Policy = Permissions.OrdersAssign)]
    [ProducesResponseType(typeof(ApiResponse<OrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignEmployee(Guid id, [FromBody] AssignOrderEmployeeRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new AssignOrderEmployeeCommand(id, request.EmployeeId), cancellationToken);
        return ToActionResult(result);
    }
}
