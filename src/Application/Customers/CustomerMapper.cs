using MathilensERP.Domain.Customers;

namespace MathilensERP.Application.Customers;

internal static class CustomerMapper
{
    public static CustomerDto ToDto(this Customer customer) =>
        new(
            customer.Id,
            customer.FullName,
            customer.PhoneNumber,
            customer.Email,
            customer.Address,
            customer.Notes,
            customer.Gender,
            customer.Religion,
            customer.DateOfBirth,
            customer.WeddingDate,
            customer.CreatedAtUtc);
}
