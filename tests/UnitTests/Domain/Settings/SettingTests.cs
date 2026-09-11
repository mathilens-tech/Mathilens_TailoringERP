using MathilensERP.Domain.Settings;

namespace MathilensERP.UnitTests.Domain.Settings;

public class SettingTests
{
    [Fact]
    public void Create_WithValidInputs_SetsKeyAndValue()
    {
        var setting = Setting.Create("Shop.BusinessName", "Mathilens Tailoring");

        Assert.NotEqual(Guid.Empty, setting.Id);
        Assert.Equal("Shop.BusinessName", setting.Key);
        Assert.Equal("Mathilens Tailoring", setting.Value);
    }

    [Fact]
    public void Create_WithBlankKey_Throws()
    {
        Assert.Throws<ArgumentException>(() => Setting.Create(" ", "value"));
    }

    [Fact]
    public void UpdateValue_ReplacesValue()
    {
        var setting = Setting.Create("Shop.BusinessName", "Old Name");

        setting.UpdateValue("New Name");

        Assert.Equal("New Name", setting.Value);
    }
}
