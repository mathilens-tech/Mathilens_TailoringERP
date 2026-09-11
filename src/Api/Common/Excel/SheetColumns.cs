namespace MathilensERP.Api.Common.Excel;

/// <summary>
/// The column headers of the customer import/export sheet. Export writes them in this order;
/// import matches on the header text, so an operator may reorder or omit optional columns.
/// </summary>
public static class CustomerSheet
{
    public const string Id = "Id";
    public const string FullName = "Full Name";
    public const string PhoneNumber = "Phone Number";
    public const string Email = "Email";
    public const string Address = "Address";
    public const string Notes = "Notes";

    public static readonly string[] Headers = [Id, FullName, PhoneNumber, Email, Address, Notes];
}

/// <summary>The column headers of the employee import/export sheet.</summary>
public static class EmployeeSheet
{
    public const string Id = "Id";
    public const string EmployeeCode = "Employee Code";
    public const string FullName = "Full Name";
    public const string JobTitle = "Job Title";
    public const string PhoneNumber = "Phone Number";
    public const string Email = "Email";

    public static readonly string[] Headers = [Id, EmployeeCode, FullName, JobTitle, PhoneNumber, Email];
}

/// <summary>The column headers of the cloth price import/export sheet.</summary>
public static class ClothPriceSheet
{
    public const string Id = "Id";
    public const string ClothCode = "Cloth Code";
    public const string ClothName = "Cloth Name";
    public const string CostPrice = "Cost Price";
    public const string SellingPrice = "Selling Price";

    public static readonly string[] Headers = [Id, ClothCode, ClothName, CostPrice, SellingPrice];
}
