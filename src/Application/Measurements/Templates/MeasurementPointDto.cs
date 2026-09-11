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
[JsonConverter(typeof(MeasurementPointDtoJsonConverter))]
public sealed record MeasurementPointDto(string Name, MeasurementPointType Type)
{
    /// <summary>A point as the old format expressed it: a name, taking a figure.</summary>
    public static MeasurementPointDto Number(string name) => new(name, MeasurementPointType.Number);
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

        return new MeasurementPointDto(name ?? string.Empty, type);
    }

    public override void Write(Utf8JsonWriter writer, MeasurementPointDto value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("name", value.Name);
        writer.WriteString("type", value.Type.ToString());
        writer.WriteEndObject();
    }
}
