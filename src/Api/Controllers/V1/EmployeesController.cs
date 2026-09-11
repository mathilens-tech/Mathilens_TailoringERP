using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Common.Excel;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Employees;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Employees.Commands.Create;
using MathilensERP.Application.Employees.Commands.Import;
using MathilensERP.Application.Employees.Commands.Update;
using MathilensERP.Application.Employees.Queries.OrderHistory;
using MathilensERP.Application.Employees.Commands.Retire;
using MathilensERP.Application.Employees.Queries.GetById;
using MathilensERP.Application.Employees.Queries.ListAll;
using MathilensERP.Application.Employees.Queries.Search;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Employee management endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md § 10.6). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/employees")]
[Authorize(Policy = Permissions.EmployeesView)]
public sealed class EmployeesController : ApiControllerBase
{
    private readonly ISender _sender;

    public EmployeesController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Downloads every employee as an .xlsx sheet. The Id column round-trips back through <see cref="Import"/> as the match key.</summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export([FromQuery] ExportFormat format = ExportFormat.Xlsx, CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ListAllEmployeesQuery(), cancellationToken);
        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        // The PDF drops the Id column: nothing re-imports a PDF, and a column of GUIDs costs page
        // width on a document somebody is going to read.
        return format == ExportFormat.Pdf
            ? ExportResultFactory.Create(
                format,
                "Employees",
                "employees",
                ["Code", "Name", "Job title", "Phone", "Email"],
                result.Value.Select(e => new object?[] { e.EmployeeCode, e.FullName, e.JobTitle, e.PhoneNumber, e.Email }).ToList())
            : ExportResultFactory.Create(
                format,
                "Employees",
                "employees",
                EmployeeSheet.Headers,
                result.Value.Select(e => new object?[] { e.Id, e.EmployeeCode, e.FullName, e.JobTitle, e.PhoneNumber, e.Email }).ToList());
    }

    /// <summary>
    /// Upserts employees from an .xlsx sheet — matched on Id, else phone number. A row with no
    /// phone number and no Id has nothing to match on and is always inserted.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Policy = Permissions.EmployeesImport)]
    [RequestSizeLimit(ImportLimits.MaxFileBytes)]
    [ProducesResponseType(typeof(ApiResponse<ImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return ToActionResult(Result.Failure<ImportResultDto>(
                Error.Validation("Import.NoFile", "Select an .xlsx file to import.")));
        }

        IReadOnlyList<ExcelRow> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelSheet.Read(stream);
        }
        catch (InvalidDataException ex)
        {
            return ToActionResult(Result.Failure<ImportResultDto>(Error.Validation("Import.InvalidFile", ex.Message)));
        }

        var command = new ImportEmployeesCommand(rows
            .Select(r => new EmployeeImportRow(
                r.RowNumber,
                r.GetGuid(EmployeeSheet.Id),
                r.GetRequiredString(EmployeeSheet.EmployeeCode),
                r.GetRequiredString(EmployeeSheet.FullName),
                r.GetString(EmployeeSheet.JobTitle),
                r.GetRequiredString(EmployeeSheet.PhoneNumber),
                r.GetString(EmployeeSheet.Email)))
            .ToList());

        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Creates a new employee.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.EmployeesCreate)]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateEmployeeCommand(
            request.EmployeeCode, request.FullName, request.JobTitle, request.PhoneNumber, request.Email,
            request.JoiningDate, request.EmploymentType);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single employee by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetEmployeeByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Searches employees by name/phone number, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<EmployeeDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new SearchEmployeesQuery(search, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>Updates an existing employee's details.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.EmployeesEdit)]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateEmployeeCommand(
            id, request.EmployeeCode, request.FullName, request.JobTitle, request.PhoneNumber, request.Email,
            request.JoiningDate, request.EmploymentType);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    // Deliberately no delete endpoint. Staff leave, they do not stop having existed: their order
    // history has to stay readable, and their code and phone stay theirs so an old job card still
    // resolves to the right person. Retire below is the operation that ends someone's employment.

    /// <summary>
    /// Records that an employee has left, as of their last working day — or reverses it when
    /// <c>lastWorkingDate</c> is null. Distinct from deleting: their order history stays, and so
    /// does their code and phone number.
    /// </summary>
    [HttpPost("{id:guid}/retire")]
    [Authorize(Policy = Permissions.EmployeesRetire)]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Retire(Guid id, [FromBody] RetireEmployeeRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RetireEmployeeCommand(id, request.LastWorkingDate), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Every order assigned to this employee, newest first, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet("{id:guid}/orders")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<EmployeeOrderDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> OrderHistory(
        Guid id,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new GetEmployeeOrderHistoryQuery(id, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }
}
