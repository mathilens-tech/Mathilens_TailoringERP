namespace MathilensERP.Domain.Customers;

/// <summary>
/// A customer's gender, which drives garment cut and fit. Optional on
/// <see cref="Customer"/>: the shop has years of customers on file who were never asked, and
/// forcing a value on them would be inventing data rather than recording it.
/// </summary>
public enum Gender
{
    Male,
    Female
}
