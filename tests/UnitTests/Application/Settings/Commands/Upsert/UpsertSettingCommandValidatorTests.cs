using MathilensERP.Application.Settings.Commands.Upsert;

namespace MathilensERP.UnitTests.Application.Settings.Commands.Upsert;

public class UpsertSettingCommandValidatorTests
{
    private readonly UpsertSettingCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_Passes()
    {
        var result = _validator.Validate(new UpsertSettingCommand("Shop.BusinessName", "Mathilens Tailoring"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithBlankKey_Fails()
    {
        var result = _validator.Validate(new UpsertSettingCommand("", "value"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpsertSettingCommand.Key));
    }

    [Fact]
    public void Validate_WithNullValue_Fails()
    {
        var result = _validator.Validate(new UpsertSettingCommand("Shop.BusinessName", null!));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpsertSettingCommand.Value));
    }
}
