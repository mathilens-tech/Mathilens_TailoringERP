using System.Text.Json;
using MathilensERP.Application.Measurements.Templates;
using MathilensERP.Domain.Measurements;

namespace MathilensERP.UnitTests.Application.Measurements.Templates;

/// <summary>
/// A measurement template saved before points could carry a range, a second box or a decimals flag
/// must keep working once they can.
///
/// <para>These are the upgrade tests. Templates live as JSON in Settings, so a shop that has been
/// running for months holds rows written by the older shape — and the first thing the new code does
/// on the first request after a deployment is read them. Nothing migrates that JSON, by design:
/// rewriting every shop's template to add four nulls would be a data change made for the schema's
/// convenience rather than the shop's. The read has to tolerate the old shape instead, and this is
/// what says so.</para>
///
/// <para>The defaults matter as much as the parsing. A point with no decimals flag has to keep
/// accepting decimals, because before the flag existed there was nothing stopping one being
/// entered — reading the absent flag as "whole numbers only" would make figures already recorded
/// against that point invalid.</para>
/// </summary>
public class MeasurementPointDtoBackCompatTests
{
    /// <summary>Exactly what the old writer produced: a name and a type, and nothing else.</summary>
    private const string OldShape = """{"name":"Chest","type":"Number"}""";

    [Fact]
    public void Deserialize_APointSavedBeforeTheNewFieldsExisted_Succeeds()
    {
        var point = JsonSerializer.Deserialize<MeasurementPointDto>(OldShape);

        Assert.NotNull(point);
        Assert.Equal("Chest", point!.Name);
        Assert.Equal(MeasurementPointType.Number, point.Type);
    }

    [Fact]
    public void Deserialize_APointSavedBeforeTheNewFieldsExisted_LeavesThemUnset()
    {
        var point = JsonSerializer.Deserialize<MeasurementPointDto>(OldShape)!;

        Assert.Null(point.Min);
        Assert.Null(point.Max);
        Assert.Null(point.SecondName);
        Assert.Null(point.Decimals);
    }

    [Fact]
    public void AnOldPoint_StillAcceptsDecimals()
    {
        var point = JsonSerializer.Deserialize<MeasurementPointDto>(OldShape)!;

        // The permissive default. Anything else retrospectively invalidates figures already stored.
        Assert.True(point.AllowsDecimals);
    }

    [Fact]
    public void AnOldPoint_OffersNoPadAndNoSecondBox()
    {
        var point = JsonSerializer.Deserialize<MeasurementPointDto>(OldShape)!;

        // Absent rather than broken: the point behaves exactly as it did before the features
        // existed, which is what somebody who has not opened Settings since should see.
        Assert.False(point.HasRange);
        Assert.False(point.HasSecondValue);
    }

    [Fact]
    public void Serialize_APointWithNothingNewSet_WritesTheOldShapeBack()
    {
        var point = JsonSerializer.Deserialize<MeasurementPointDto>(OldShape)!;

        var written = JsonSerializer.Serialize(point);

        // Null fields are omitted, so a template read and saved untouched is byte-identical. A
        // writer that added "min":null to every point would churn every shop's settings on the
        // first save after the deployment and make the diff impossible to read afterwards.
        Assert.Equal(OldShape, written);
    }

    [Fact]
    public void Deserialize_APointCarryingAFieldThisVersionDoesNotKnow_IgnoresIt()
    {
        // Forward compatibility, which matters during a rollback: a template saved by a newer
        // build must not break the build somebody has just reverted to.
        var future = """{"name":"Chest","type":"Number","somethingAddedLater":{"nested":true}}""";

        var point = JsonSerializer.Deserialize<MeasurementPointDto>(future);

        Assert.NotNull(point);
        Assert.Equal("Chest", point!.Name);
    }
}
