using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.GetPublicInvoice;

public sealed class GetPublicInvoiceQueryHandler : IQueryHandler<GetPublicInvoiceQuery, Result<PublicInvoiceDto>>
{
    /// <summary>Falls back to the product's own name only when the shop has not set its own.</summary>
    private const string DefaultShopName = "Mathilens";

    private const string ShopNameKey = "Shop.Name";
    private const string ShopAddressKey = "Shop.Address";
    private const string ShopContactNumberKey = "Shop.ContactNumber";

    private readonly IInvoiceShareTokenService _shareTokens;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly ISettingRepository _settingRepository;

    public GetPublicInvoiceQueryHandler(
        IInvoiceShareTokenService shareTokens,
        IInvoiceRepository invoiceRepository,
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        ISettingRepository settingRepository)
    {
        _shareTokens = shareTokens;
        _invoiceRepository = invoiceRepository;
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _settingRepository = settingRepository;
    }

    public async Task<Result<PublicInvoiceDto>> Handle(GetPublicInvoiceQuery query, CancellationToken cancellationToken)
    {
        // One failure for every way this can go wrong — bad token, good token for an invoice that
        // has since been deleted, an order that is gone. Telling them apart would let a caller with
        // a guessed token learn which invoices exist, and a customer can do nothing with the
        // difference anyway.
        var notFound = Error.NotFound("Invoice.NotFound", "This invoice link is not valid. Please ask the shop for a new one.");

        if (!_shareTokens.TryRead(query.Token, out var invoiceId))
        {
            return Result.Failure<PublicInvoiceDto>(notFound);
        }

        var invoice = await _invoiceRepository.GetByIdAsync(invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result.Failure<PublicInvoiceDto>(notFound);
        }

        var order = await _orderRepository.GetByIdAsync(invoice.OrderId, cancellationToken);
        var customer = await _customerRepository.GetByIdAsync(invoice.CustomerId, cancellationToken);
        if (order is null || customer is null)
        {
            return Result.Failure<PublicInvoiceDto>(notFound);
        }

        var items = order.Items
            .Select(item => new PublicInvoiceItemDto(
                item.GarmentType,
                item.Quantity,
                item.UnitPrice,
                item.Quantity * item.UnitPrice))
            .ToList();

        return new PublicInvoiceDto(
            await SettingOrDefaultAsync(ShopNameKey, DefaultShopName, cancellationToken) ?? DefaultShopName,
            await SettingOrDefaultAsync(ShopAddressKey, null, cancellationToken),
            await SettingOrDefaultAsync(ShopContactNumberKey, null, cancellationToken),
            customer.FullName,
            // The ten digits, not the stored +91XXXXXXXXXX — this is a page a customer reads.
            IndianPhoneNumber.ToDisplay(customer.PhoneNumber),
            invoice.InvoiceNumber,
            invoice.CreatedAtUtc,
            order.OrderNumber,
            order.DueAtUtc,
            items,
            invoice.Subtotal,
            invoice.TaxAmount,
            invoice.DiscountAmount,
            invoice.TotalAmount,
            invoice.AmountPaid,
            invoice.RemainingBalance);
    }

    private async Task<string?> SettingOrDefaultAsync(string key, string? fallback, CancellationToken cancellationToken)
    {
        var setting = await _settingRepository.GetByKeyAsync(key, cancellationToken);
        return string.IsNullOrWhiteSpace(setting?.Value) ? fallback : setting.Value;
    }
}
