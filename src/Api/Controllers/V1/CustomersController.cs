using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Common.Excel;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Customers;
using MathilensERP.Application.Common;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Application.Customers.Commands.Delete;
using MathilensERP.Application.Customers.Commands.Import;
using MathilensERP.Application.Customers.Commands.Update;
using MathilensERP.Application.Customers.Queries.FindDuplicates;
using MathilensERP.Application.Customers.Queries.GetById;
using MathilensERP.Application.Customers.Queries.ListAll;
using MathilensERP.Application.Customers.Queries.Search;
using MathilensERP.Domain.Customers;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Customer management endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md § 10.3). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/customers")]
[Authorize(Policy = Permissions.CustomersView)]
public sealed class CustomersController : ApiControllerBase
{
    private readonly ISender _sender;

    public CustomersController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Creates a new customer.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.CustomersCreate)]
    [ProducesResponseType(typeof(ApiResponse<CustomerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateCustomerCommand(
            request.FullName,
            request.PhoneNumber,
            request.Email,
            request.Address,
            request.Notes,
            request.Gender,
            request.Religion,
            request.DateOfBirth,
            request.WeddingDate);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single customer by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetCustomerByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Searches customers by name/phone number and optionally narrows by religion, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] Religion? religion,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new SearchCustomersQuery(search, religion, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>
    /// Downloads every customer, as a spreadsheet or a PDF.
    ///
    /// The spreadsheet keeps its Id column because it round-trips back through <see cref="Import"/>
    /// as the match key. The PDF drops it: nothing re-imports a PDF, and a column of GUIDs costs a
    /// third of the page width on a document somebody is going to read.
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export([FromQuery] ExportFormat format = ExportFormat.Xlsx, CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ListAllCustomersQuery(), cancellationToken);
        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        return format == ExportFormat.Pdf
            ? ExportResultFactory.Create(
                format,
                "Customers",
                "customers",
                ["Name", "Phone", "Email", "Address", "Notes"],
                result.Value.Select(c => new object?[] { c.FullName, c.PhoneNumber, c.Email, c.Address, c.Notes }).ToList())
            : ExportResultFactory.Create(
                format,
                "Customers",
                "customers",
                CustomerSheet.Headers,
                result.Value.Select(c => new object?[] { c.Id, c.FullName, c.PhoneNumber, c.Email, c.Address, c.Notes }).ToList());
    }

    /// <summary>
    /// Upserts customers from an .xlsx sheet — matched on Id, else phone number. Partial success:
    /// valid rows are saved and invalid ones come back listed by their row number.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Policy = Permissions.CustomersImport)]
    [RequestSizeLimit(ImportLimits.MaxFileBytes)]
    [ProducesResponseType(typeof(ApiResponse<ImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        var (rows, failure) = await ReadImportRowsAsync(file);
        if (failure is not null)
        {
            return ToActionResult(Result.Failure<ImportResultDto>(failure));
        }

        var result = await _sender.Send(new ImportCustomersCommand(rows!), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Reports what <see cref="Import"/> would do with this file, without doing any of it (FR-04).
    ///
    /// <para>The same upload, sent to the same row planner, so the counts the operator approves are
    /// the counts they get. Nothing here writes, which is why it is safe to call on every file
    /// chosen — including the ones the operator then thinks better of.</para>
    /// </summary>
    [HttpPost("import/preview")]
    [Authorize(Policy = Permissions.CustomersImport)]
    [RequestSizeLimit(ImportLimits.MaxFileBytes)]
    [ProducesResponseType(typeof(ApiResponse<CustomerImportPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PreviewImport(IFormFile file, CancellationToken cancellationToken)
    {
        var (rows, failure) = await ReadImportRowsAsync(file);
        if (failure is not null)
        {
            return ToActionResult(Result.Failure<CustomerImportPreviewDto>(failure));
        }

        var result = await _sender.Send(new PreviewCustomerImportQuery(rows!), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Shared by the import and its preview so the two can never read a file differently.</summary>
    private static async Task<(IReadOnlyList<CustomerImportRow>? Rows, Error? Failure)> ReadImportRowsAsync(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return (null, Error.Validation("Import.NoFile", "Select an .xlsx file to import."));
        }

        IReadOnlyList<ExcelRow> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelSheet.Read(stream);
        }
        catch (InvalidDataException ex)
        {
            return (null, Error.Validation("Import.InvalidFile", ex.Message));
        }

        return (rows
            .Select(r => new CustomerImportRow(
                r.RowNumber,
                r.GetGuid(CustomerSheet.Id),
                r.GetRequiredString(CustomerSheet.FullName),
                r.GetRequiredString(CustomerSheet.PhoneNumber),
                r.GetString(CustomerSheet.Email),
                r.GetString(CustomerSheet.Address),
                r.GetString(CustomerSheet.Notes)))
            .ToList(), null);
    }

    /// <summary>
    /// Customers already holding this phone number or email (FR-04).
    ///
    /// <para>Advisory — it reports, it does not refuse. The form calls it as the operator leaves
    /// the phone or email field so a second record for someone already on the books can be caught
    /// while there is still nothing to undo.</para>
    /// </summary>
    [HttpGet("duplicates")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerDuplicateDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> FindDuplicates(
        [FromQuery] string? phone,
        [FromQuery] string? email,
        [FromQuery] Guid? excludeId,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new FindCustomerDuplicatesQuery(phone, email, excludeId), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Updates an existing customer's details.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.CustomersEdit)]
    [ProducesResponseType(typeof(ApiResponse<CustomerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateCustomerCommand(
            id,
            request.FullName,
            request.PhoneNumber,
            request.Email,
            request.Address,
            request.Notes,
            request.Gender,
            request.Religion,
            request.DateOfBirth,
            request.WeddingDate);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Soft-deletes a customer.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.CustomersDelete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new DeleteCustomerCommand(id), cancellationToken);
        return ToActionResult(result);
    }
}
