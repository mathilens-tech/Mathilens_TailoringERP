using FluentValidation;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Import;

public sealed class PreviewCustomerImportQueryHandler
    : IQueryHandler<PreviewCustomerImportQuery, Result<CustomerImportPreviewDto>>
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IValidator<CreateCustomerCommand> _rowValidator;

    public PreviewCustomerImportQueryHandler(ICustomerRepository customerRepository, IValidator<CreateCustomerCommand> rowValidator)
    {
        _customerRepository = customerRepository;
        _rowValidator = rowValidator;
    }

    public async Task<Result<CustomerImportPreviewDto>> Handle(
        PreviewCustomerImportQuery query,
        CancellationToken cancellationToken)
    {
        // The same planner the import itself runs, so these numbers are a promise rather than an
        // estimate. Nothing is added or mutated here — the plan is only read.
        var plan = await CustomerImportPlanner.PlanAsync(
            query.Rows, _customerRepository, _rowValidator, includeEmailWarnings: true, cancellationToken);

        var duplicates = new List<CustomerImportDuplicateDto>();

        foreach (var step in plan)
        {
            var reason = step.Action switch
            {
                CustomerImportAction.UpdateExisting =>
                    $"Will update the existing customer {step.ExistingMatch!.FullName}.",
                CustomerImportAction.UpdateEarlierRow =>
                    $"Same phone number as row {step.EarlierRowNumber}; the two rows will be merged into one customer.",
                // A shared email alone changes nothing about the row — it is flagged so the
                // operator can spot a family address being reused for a second person by mistake.
                CustomerImportAction.Create when step.EmailOwner is not null =>
                    $"New customer, but this email is already on {step.EmailOwner.FullName}.",
                _ => null,
            };

            if (reason is not null)
            {
                duplicates.Add(new CustomerImportDuplicateDto(
                    step.Row.RowNumber, step.Row.FullName, step.PhoneNumber, reason));
            }
        }

        return Result.Success(new CustomerImportPreviewDto(
            query.Rows.Count,
            plan.Count(s => s.Action == CustomerImportAction.Create),
            plan.Count(s => s.Action is CustomerImportAction.UpdateExisting or CustomerImportAction.UpdateEarlierRow),
            plan.Where(s => s.Action == CustomerImportAction.Fail)
                .Select(s => new ImportRowErrorDto(s.Row.RowNumber, s.Error!))
                .ToList(),
            duplicates));
    }
}
