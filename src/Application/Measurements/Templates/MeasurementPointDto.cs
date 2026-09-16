using System.Text.Json;
using System.Text.Json.Serialization;
using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements.Templates;

/// <summary>
/// One point on a garment's template: what to ask for, and what kind of answer it takes.
///
/// <para>A point used to be a bare string, and the stored templates still hold arrays of strings.
/// Both shapes are read — a string is a number point, which is what every point was when it was
/// written — so no shop's saved template had to be rewritten to add types. New saves are written in
/// the object form.</para>
/// </summary>
/// <param name="Name">What the shop calls this point.</param>
/// <param name="Type">What kind of answer it takes.</param>
/// <param name="Min">
/// The lowest figure the entry pad offers, on a Number point. Null means no pad — which is every
/// point written before this existed, and every one the shop has not set a range on.
/// </param>
/// <param name="Max">The highest figure the pad offers. Null alongside <paramref name="Min"/>.</param>
/// <param name="SecondName">
/// The label of a second box on the same point, or null for the single box every point had before.
///
/// <para>Some measurements are taken twice — loose and tight, left and right, before and after an
/// alteration — and recording them as two separate points meant nothing tied the pair together:
/// either could be filled and the other left blank with no way to notice. Naming the second box is
/// also what turns this on; a point with no second name has one box.</para>
/// </param>
/// <param name="Decimals">
/// Whether this point accepts fractions. False means whole numbers only.
///
/// <para>Null on every point written before this existed, which is read as decimals allowed — that
/// is what those points already did, and tightening them silently would reject figures a shop has
/// been recording for months.</para>
/// </param>
[JsonConverter(typeof(MeasurementPointDtoJsonConverter))]
public sealed record MeasurementPointDto(
    string Name,
    MeasurementPointType Type,
    decimal? Min = null,
    decimal? Max = null,
    string? SecondName = null,
    bool? Decimals = null)
{
    /// <summary>Whether this point asks for two figures rather than one.</summary>
    public bool HasSecondValue => Type == MeasurementPointType.Number
        && !string.IsNullOrWhiteSpace(SecondName);

    /// <summary>Fractions allowed. The default for anything that has never said otherwise.</summary>
    public bool AllowsDecimals => Decimals ?? true;

    /// <summary>A point as the old format expressed it: a name, taking a figure.</summary>
    public static MeasurementPointDto Number(string name) => new(name, MeasurementPointType.Number);

    /// <summary>
    /// Whether this point can offer a pad.
    ///
    /// <para>Both ends, and the right way round. One end alone cannot lay a pad out, and a minimum
    /// above its maximum would produce an empty one — in either case the field falls back to plain
    /// typing rather than showing a control with nothing in it.</para>
    /// </summary>
    public bool HasRange => Type == MeasurementPointType.Number
        && Min is { } min
        && Max is { } max
        && max > min;
}

/// <summary>
/// Reads <c>"Chest"</c> and <c>{"name":"Side pocket","type":"Checkbox"}</c> alike; writes the
/// second. The same tolerate-the-old-shape-on-read approach the shop holidays setting uses.
/// </summary>
public sealed class MeasurementPointDtoJsonConverter : JsonConverter<MeasurementPointDto>
{
    public override MeasurementPointDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            return MeasurementPointDto.Number(reader.GetString() ?? string.Empty);
        }

        if (reader.TokenType != JsonTokenType.StartObject)
        {
            throw new JsonException($"A measurement point must be a string or an object, not {reader.TokenType}.");
        }

        string? name = null;
        var type = MeasurementPointType.Number;
        decimal? min = null;
        decimal? max = null;
        string? secondName = null;
        bool? decimals = null;

        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            if (reader.TokenType != JsonTokenType.PropertyName)
            {
                continue;
            }

            var property = reader.GetString();
            reader.Read();

            if (string.Equals(property, "name", StringComparison.OrdinalIgnoreCase))
            {
                name = reader.GetString();
            }
            // Absent on every template written before ranges existed, which is why both stay null
            // rather than defaulting to a span — a point with no range typed is a point with no pad,
            // not one bounded by numbers nobody chose. Null is also how a range is cleared.
            else if (string.Equals(property, "min", StringComparison.OrdinalIgnoreCase))
            {
                min = reader.TokenType == JsonTokenType.Number ? reader.GetDecimal() : null;
            }
            else if (string.Equals(property, "max", StringComparison.OrdinalIgnoreCase))
            {
                max = reader.TokenType == JsonTokenType.Number ? reader.GetDecimal() : null;
            }
            else if (string.Equals(property, "secondName", StringComparison.OrdinalIgnoreCase))
            {
                secondName = reader.TokenType == JsonTokenType.String ? reader.GetString() : null;
            }
            else if (string.Equals(property, "decimals", StringComparison.OrdinalIgnoreCase))
            {
                // Left null on anything that is not a boolean, so a malformed value reads as "never
                // said", which allows decimals — the behaviour every older point already has.
                decimals = reader.TokenType switch
                {
                    JsonTokenType.True => true,
                    JsonTokenType.False => false,
                    _ => null,
                };
            }
            else if (string.Equals(property, "type", StringComparison.OrdinalIgnoreCase))
            {
                // An unrecognised type falls back to Number rather than failing the whole template
                // — one bad point should not make a garment unmeasurable.
                type = Enum.TryParse<MeasurementPointType>(reader.GetString(), ignoreCase: true, out var parsed)
                    ? parsed
                    : MeasurementPointType.Number;
            }
            else
            {
                reader.Skip();
            }
        }

        return new MeasurementPointDto(name ?? string.Empty, type, min, max, secondName, decimals);
    }

    public override void Write(Utf8JsonWriter writer, MeasurementPointDto value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("name", value.Name);
        writer.WriteString("type", value.Type.ToString());

        // Written only when set. A template of points each carrying "min": null is harder to read by
        // hand than one where the property's absence says the same thing, and these are stored in
        // the settings table where a person does read them.
        if (value.Min is { } min)
        {
            writer.WriteNumber("min", min);
        }

        if (value.Max is { } max)
        {
            writer.WriteNumber("max", max);
        }

        if (!string.IsNullOrWhiteSpace(value.SecondName))
        {
            writer.WriteString("secondName", value.SecondName);
        }

        // Written only when the shop has decided, so a template that has never been asked stays
        // free of the property and keeps reading as "decimals allowed".
        if (value.Decimals is { } decimals)
        {
            writer.WriteBoolean("decimals", decimals);
        }

        writer.WriteEndObject();
    }
}
