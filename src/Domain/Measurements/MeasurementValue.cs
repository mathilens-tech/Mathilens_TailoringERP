using System.Text.Json;
using System.Text.Json.Serialization;

namespace MathilensERP.Domain.Measurements;

/// <summary>
/// One recorded answer: a figure, a yes/no, or a word.
///
/// <para>Stored as the natural JSON scalar it is — <c>40</c>, <c>true</c>, <c>"open"</c> — so a
/// measurement set reads as <c>{"Chest": 40, "Side pocket": true, "V.H Style": "open"}</c>. That
/// shape is the reason nothing had to be migrated when points stopped being numbers-only: every
/// measurement already in the books is a JSON object of numbers, and a number still parses as a
/// number. Older rows keep working, and so does anything that read them.</para>
/// </summary>
[JsonConverter(typeof(MeasurementValueJsonConverter))]
public readonly record struct MeasurementValue
{
    private MeasurementValue(MeasurementPointType kind, decimal number, bool flag, string? text)
    {
        Kind = kind;
        Number = number;
        Flag = flag;
        Text = text;
    }

    public MeasurementPointType Kind { get; }

    /// <summary>Meaningful only when <see cref="Kind"/> is Number.</summary>
    public decimal Number { get; }

    /// <summary>Meaningful only when <see cref="Kind"/> is Checkbox.</summary>
    public bool Flag { get; }

    /// <summary>Meaningful only when <see cref="Kind"/> is Text.</summary>
    public string? Text { get; }

    public static MeasurementValue FromNumber(decimal value) => new(MeasurementPointType.Number, value, false, null);

    public static MeasurementValue FromFlag(bool value) => new(MeasurementPointType.Checkbox, 0m, value, null);

    public static MeasurementValue FromText(string value) => new(MeasurementPointType.Text, 0m, false, value);

    /// <summary>How the value reads on a job card or an order printout.</summary>
    public override string ToString() => Kind switch
    {
        MeasurementPointType.Checkbox => Flag ? "Yes" : "No",
        MeasurementPointType.Text => Text ?? string.Empty,
        _ => Number.ToString("0.##"),
    };
}

/// <summary>
/// Reads and writes a <see cref="MeasurementValue"/> as a bare JSON scalar rather than an object.
///
/// <para>Writing <c>{"kind":"Number","number":40}</c> would have been easier and wrong: it would
/// have made every measurement already stored unreadable, and turned a column a person can inspect
/// into one they cannot.</para>
/// </summary>
public sealed class MeasurementValueJsonConverter : JsonConverter<MeasurementValue>
{
    public override MeasurementValue Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.Number => MeasurementValue.FromNumber(reader.GetDecimal()),
            JsonTokenType.True => MeasurementValue.FromFlag(true),
            JsonTokenType.False => MeasurementValue.FromFlag(false),
            JsonTokenType.String => MeasurementValue.FromText(reader.GetString() ?? string.Empty),
            _ => throw new JsonException($"A measurement value must be a number, a boolean or a string, not {reader.TokenType}."),
        };

    public override void Write(Utf8JsonWriter writer, MeasurementValue value, JsonSerializerOptions options)
    {
        switch (value.Kind)
        {
            case MeasurementPointType.Checkbox:
                writer.WriteBooleanValue(value.Flag);
                break;
            case MeasurementPointType.Text:
                writer.WriteStringValue(value.Text ?? string.Empty);
                break;
            default:
                writer.WriteNumberValue(value.Number);
                break;
        }
    }
}
