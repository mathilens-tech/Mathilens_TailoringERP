using MathilensERP.Domain.Common;

namespace MathilensERP.UnitTests.Domain.Common;

/// <summary>Minimal concrete entity for exercising <see cref="AuditableEntity"/>.</summary>
file sealed class TestEntity : AuditableEntity
{
    public TestEntity(Guid id)
        : base(id)
    {
    }
}

public class AuditableEntityTests
{
    [Fact]
    public void Constructor_WithValidId_SetsId()
    {
        var id = Guid.NewGuid();

        var entity = new TestEntity(id);

        Assert.Equal(id, entity.Id);
    }

    [Fact]
    public void Constructor_WithEmptyId_Throws()
    {
        Assert.Throws<ArgumentException>(() => new TestEntity(Guid.Empty));
    }

    [Fact]
    public void SetCreationAudit_StampsCreatedByAndCreatedAtUtc()
    {
        var entity = new TestEntity(Guid.NewGuid());
        var createdBy = Guid.NewGuid();
        var now = DateTime.UtcNow;

        entity.SetCreationAudit(createdBy, now);

        Assert.Equal(createdBy, entity.CreatedBy);
        Assert.Equal(now, entity.CreatedAtUtc);
    }

    [Fact]
    public void SetModificationAudit_StampsLastModifiedByAndAtUtc()
    {
        var entity = new TestEntity(Guid.NewGuid());
        var modifiedBy = Guid.NewGuid();
        var now = DateTime.UtcNow;

        entity.SetModificationAudit(modifiedBy, now);

        Assert.Equal(modifiedBy, entity.LastModifiedBy);
        Assert.Equal(now, entity.LastModifiedAtUtc);
    }

    [Fact]
    public void SoftDelete_MarksEntityDeletedWithAuditDetails()
    {
        var entity = new TestEntity(Guid.NewGuid());
        var deletedBy = Guid.NewGuid();
        var now = DateTime.UtcNow;

        entity.SoftDelete(deletedBy, now);

        Assert.True(entity.IsDeleted);
        Assert.Equal(deletedBy, entity.DeletedBy);
        Assert.Equal(now, entity.DeletedAtUtc);
    }

    [Fact]
    public void SoftDelete_WhenAlreadyDeleted_DoesNotOverwriteAuditDetails()
    {
        var entity = new TestEntity(Guid.NewGuid());
        var firstDeletedBy = Guid.NewGuid();
        var firstDeletedAt = DateTime.UtcNow;
        entity.SoftDelete(firstDeletedBy, firstDeletedAt);

        entity.SoftDelete(Guid.NewGuid(), DateTime.UtcNow.AddMinutes(5));

        Assert.Equal(firstDeletedBy, entity.DeletedBy);
        Assert.Equal(firstDeletedAt, entity.DeletedAtUtc);
    }

    [Fact]
    public void Restore_ClearsSoftDeleteState()
    {
        var entity = new TestEntity(Guid.NewGuid());
        entity.SoftDelete(Guid.NewGuid(), DateTime.UtcNow);

        entity.Restore();

        Assert.False(entity.IsDeleted);
        Assert.Null(entity.DeletedBy);
        Assert.Null(entity.DeletedAtUtc);
    }
}
