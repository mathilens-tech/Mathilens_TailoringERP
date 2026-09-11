using MathilensERP.Domain.Customers;

namespace MathilensERP.UnitTests.Domain.Customers;

public class OccasionContactTests
{
    [Fact]
    public void Record_WithValidInputs_SetsAllFields()
    {
        var customerId = Guid.NewGuid();

        var contact = OccasionContact.Record(
            customerId,
            OccasionType.Birthday,
            2026,
            new DateOnly(2026, 9, 18),
            "  Called, ordered a sherwani  ");

        Assert.Equal(customerId, contact.CustomerId);
        Assert.Equal(OccasionType.Birthday, contact.Occasion);
        Assert.Equal(2026, contact.OccasionYear);
        Assert.Equal(new DateOnly(2026, 9, 18), contact.ContactedOn);
        Assert.Equal("Called, ordered a sherwani", contact.Remarks);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Record_WithBlankRemarks_StoresNull(string remarks)
    {
        var contact = OccasionContact.Record(Guid.NewGuid(), OccasionType.WeddingAnniversary, 2026, new DateOnly(2026, 5, 1), remarks);

        Assert.Null(contact.Remarks);
    }

    [Fact]
    public void Record_WithoutACustomer_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            OccasionContact.Record(Guid.Empty, OccasionType.Birthday, 2026, new DateOnly(2026, 1, 1), null));
    }

    /// <summary>Rejects 202 and 20260 before they reach the unique index and quietly split a year in two.</summary>
    [Theory]
    [InlineData(202)]
    [InlineData(20260)]
    [InlineData(1999)]
    public void Record_WithAnImplausibleYear_Throws(int year)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            OccasionContact.Record(Guid.NewGuid(), OccasionType.Birthday, year, new DateOnly(2026, 1, 1), null));
    }

    [Fact]
    public void Update_ReplacesTheRemarksAndTheDate()
    {
        var contact = OccasionContact.Record(Guid.NewGuid(), OccasionType.Birthday, 2026, new DateOnly(2026, 9, 18), "No answer");

        contact.Update(new DateOnly(2026, 9, 19), "Called back, ordered two shirts");

        Assert.Equal(new DateOnly(2026, 9, 19), contact.ContactedOn);
        Assert.Equal("Called back, ordered two shirts", contact.Remarks);
    }
}
