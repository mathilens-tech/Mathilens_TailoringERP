using FluentValidation;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing.Commands.Create;
using MathilensERP.Domain.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Import;

/// <summary>
/// Upserts a sheet of cloth prices, matched on <c>Id</c> when the file came from an export and
/// otherwise on cloth code — which the create command already enforces as unique.
/// </summary>
public sealed class ImportClothPricesCommandHandler : ICommandHandler<ImportClothPricesCommand, Result<ImportResultDto>>
{
    private readonly IClothPriceRepository _clothPriceRepository;
    private readonly IValidator<CreateClothPriceCommand> _rowValidator;

    public ImportClothPricesCommandHandler(IClothPriceRepository clothPriceRepository, IValidator<CreateClothPriceCommand> rowValidator)
    {
        _clothPriceRepository = clothPriceRepository;
        _rowValidator = rowValidator;
    }

    public async Task<Result<ImportResultDto>> Handle(ImportClothPricesCommand command, CancellationToken cancellationToken)
    {
        var errors = new List<ImportRowErrorDto>();
        var created = 0;
        var updated = 0;

        // Rows added in this batch aren't visible to a repository query until SaveChanges, so
        // without this a file listing the same cloth code twice would insert it twice.
        var addedThisBatch = new Dictionary<string, ClothPrice>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in command.Rows)
        {
            // Reuses the create command's rules so the spreadsheet and the form can never drift apart.
            var candidate = new CreateClothPriceCommand(row.ClothCode, row.ClothName, row.CostPrice, row.SellingPrice);
            var validation = await _rowValidator.ValidateAsync(candidate, cancellationToken);
            if (!validation.IsValid)
            {
                errors.Add(new ImportRowErrorDto(row.RowNumber, string.Join(" ", validation.Errors.Select(e => e.ErrorMessage))));
                continue;
            }

            try
            {
                var existing = await FindExistingAsync(row, addedThisBatch, cancellationToken);

                if (existing is null)
                {
                    var clothPrice = ClothPrice.Create(row.ClothCode, row.ClothName, row.CostPrice, row.SellingPrice);
                    _clothPriceRepository.Add(clothPrice);
                    addedThisBatch[row.ClothCode] = clothPrice;
                    created++;
                }
                else
                {
                    existing.UpdateDetails(row.ClothCode, row.ClothName, row.CostPrice, row.SellingPrice);
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
            await _clothPriceRepository.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(new ImportResultDto(created, updated, errors));
    }

    private async Task<ClothPrice?> FindExistingAsync(
        ClothPriceImportRow row,
        Dictionary<string, ClothPrice> addedThisBatch,
        CancellationToken cancellationToken)
    {
        // An id that no longer resolves (stale export, since-deleted record) falls through to
        // the cloth code rather than failing the row.
        if (row.Id is { } id && await _clothPriceRepository.GetByIdAsync(id, cancellationToken) is { } byId)
        {
            return byId;
        }

        return addedThisBatch.TryGetValue(row.ClothCode, out var pending)
            ? pending
            : await _clothPriceRepository.GetByClothCodeAsync(row.ClothCode, cancellationToken);
    }
}
