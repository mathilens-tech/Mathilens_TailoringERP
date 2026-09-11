using FluentValidation;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Import;

/// <summary>
/// Upserts a sheet of customers: a row is matched on its <c>Id</c> when the file came from an
/// export, otherwise on phone number — the same natural key the shop already treats as unique.
///
/// Every row is attempted; invalid ones are collected against their spreadsheet row number
/// rather than aborting the upload, so a 500-row file with three typos still lands 497 records
/// and hands back a short, actionable list.
///
/// What each row will do is decided by <see cref="CustomerImportPlanner"/>, the same code behind
/// the pre-import summary — this handler only carries the plan out.
/// </summary>
public sealed class ImportCustomersCommandHandler : ICommandHandler<ImportCustomersCommand, Result<ImportResultDto>>
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IValidator<CreateCustomerCommand> _rowValidator;

    public ImportCustomersCommandHandler(ICustomerRepository customerRepository, IValidator<CreateCustomerCommand> rowValidator)
    {
        _customerRepository = customerRepository;
        _rowValidator = rowValidator;
    }

    public async Task<Result<ImportResultDto>> Handle(ImportCustomersCommand command, CancellationToken cancellationToken)
    {
        var plan = await CustomerImportPlanner.PlanAsync(
            command.Rows, _customerRepository, _rowValidator, includeEmailWarnings: false, cancellationToken);

        var errors = new List<ImportRowErrorDto>();
        var created = 0;
        var updated = 0;

        // The rows this pass created, so a later row matching an earlier one updates that record
        // instead of inserting the same person a second time.
        var createdByRow = new Dictionary<int, Customer>();

        foreach (var step in plan)
        {
            if (step.Action == CustomerImportAction.Fail)
            {
                errors.Add(new ImportRowErrorDto(step.Row.RowNumber, step.Error!));
                continue;
            }

            var row = step.Row;
            try
            {
                var target = step.Action switch
                {
                    CustomerImportAction.UpdateExisting => step.ExistingMatch,
                    CustomerImportAction.UpdateEarlierRow => createdByRow.GetValueOrDefault(step.EarlierRowNumber!.Value),
                    _ => null,
                };

                if (target is null)
                {
                    var customer = Customer.Create(row.FullName, step.PhoneNumber, row.Email, row.Address, row.Notes);
                    _customerRepository.Add(customer);
                    createdByRow[row.RowNumber] = customer;
                    created++;
                }
                else
                {
                    target.UpdateDetails(row.FullName, step.PhoneNumber, row.Email, row.Address, row.Notes);
                    updated++;
                }
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                // A domain guard the row validator doesn't cover. One bad row is a row error,
                // not a failed upload.
                errors.Add(new ImportRowErrorDto(row.RowNumber, ex.Message));
            }
        }

        if (created > 0 || updated > 0)
        {
            await _customerRepository.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(new ImportResultDto(created, updated, errors));
    }
}
