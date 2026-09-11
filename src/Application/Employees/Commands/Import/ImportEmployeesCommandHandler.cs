using FluentValidation;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees.Commands.Create;
using MathilensERP.Domain.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Import;

/// <summary>
/// Upserts a sheet of employees: a row is matched on its <c>Id</c> when the file came from an
/// export, otherwise on the shop's employee code — which is required and unique, so every row
/// has a natural key to upsert against.
///
/// Every row is attempted; invalid ones are collected against their spreadsheet row number
/// rather than aborting the upload.
/// </summary>
public sealed class ImportEmployeesCommandHandler : ICommandHandler<ImportEmployeesCommand, Result<ImportResultDto>>
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly IValidator<CreateEmployeeCommand> _rowValidator;

    public ImportEmployeesCommandHandler(IEmployeeRepository employeeRepository, IValidator<CreateEmployeeCommand> rowValidator)
    {
        _employeeRepository = employeeRepository;
        _rowValidator = rowValidator;
    }

    public async Task<Result<ImportResultDto>> Handle(ImportEmployeesCommand command, CancellationToken cancellationToken)
    {
        var errors = new List<ImportRowErrorDto>();
        var created = 0;
        var updated = 0;

        // Rows added in this batch aren't visible to a repository query until SaveChanges.
        var addedThisBatch = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in command.Rows)
        {
            // Reuses the create command's rules so the spreadsheet and the form can never drift apart.
            //
            // The sheet carries no joining date or employment type, so imported rows take today and
            // Full time. Both are editable afterwards on the employee's own screen; the alternative
            // — failing every row for a column the shop's existing sheets do not have — would make
            // the importer useless for exactly the bulk load it exists for.
            var joiningDate = DateOnly.FromDateTime(DateTime.UtcNow);
            const EmploymentType employmentType = EmploymentType.FullTime;

            var candidate = new CreateEmployeeCommand(
                row.EmployeeCode, row.FullName, row.JobTitle, row.PhoneNumber, row.Email, joiningDate, employmentType);
            var validation = await _rowValidator.ValidateAsync(candidate, cancellationToken);
            if (!validation.IsValid)
            {
                errors.Add(new ImportRowErrorDto(row.RowNumber, string.Join(" ", validation.Errors.Select(e => e.ErrorMessage))));
                continue;
            }

            try
            {
                var existing = await FindExistingAsync(row, addedThisBatch, cancellationToken);

                // A row whose phone number belongs to a *different* employee is a row error, not
                // a silent overwrite of somebody else's contact details.
                var conflict = await EmployeeUniqueness.FindConflictAsync(
                    _employeeRepository, row.EmployeeCode, row.PhoneNumber, row.Email, existing?.Id, cancellationToken);
                if (conflict is not null)
                {
                    errors.Add(new ImportRowErrorDto(row.RowNumber, conflict.Message));
                    continue;
                }

                if (existing is null)
                {
                    var employee = Employee.Create(
                        row.EmployeeCode, row.FullName, row.JobTitle, row.PhoneNumber, row.Email, joiningDate, employmentType);
                    _employeeRepository.Add(employee);
                    addedThisBatch[row.EmployeeCode.Trim()] = employee;
                    created++;
                }
                else
                {
                    // An existing employee keeps the joining date and employment type already on
                    // file — the sheet does not carry them, so it must not overwrite them.
                    existing.UpdateDetails(
                        row.EmployeeCode, row.FullName, row.JobTitle, row.PhoneNumber, row.Email,
                        existing.JoiningDate, existing.EmploymentType);
                    updated++;
                }
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                errors.Add(new ImportRowErrorDto(row.RowNumber, ex.Message));
            }
        }

        if (created > 0 || updated > 0)
        {
            await _employeeRepository.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(new ImportResultDto(created, updated, errors));
    }

    private async Task<Employee?> FindExistingAsync(
        EmployeeImportRow row,
        Dictionary<string, Employee> addedThisBatch,
        CancellationToken cancellationToken)
    {
        // An id that no longer resolves (stale export, since-deleted record) falls through to
        // the employee code rather than failing the row.
        if (row.Id is { } id && await _employeeRepository.GetByIdAsync(id, cancellationToken) is { } byId)
        {
            return byId;
        }

        var code = row.EmployeeCode?.Trim();
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        return addedThisBatch.TryGetValue(code, out var pending)
            ? pending
            : await _employeeRepository.GetByEmployeeCodeAsync(code, cancellationToken);
    }
}
