using System.IO.Compression;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// The two whole-backup formats that are not a single table on a page: a zip of CSVs, and one JSON
/// document.
/// </summary>
public static class BackupArchive
{
    public const string ZipContentType = "application/zip";
    public const string JsonContentType = "application/json";

    /// <summary>
    /// One CSV per table, in a single zip.
    ///
    /// <para><see cref="CompressionLevel.Optimal"/> because this is text: a shop's orders and
    /// activity log compress to a fraction of their size, and the cost is a second of CPU on a
    /// download somebody asked for and is waiting on anyway.</para>
    /// </summary>
    public static byte[] WriteCsvZip(IReadOnlyList<ExportTable> tables)
    {
        using var stream = new MemoryStream();

        // Disposed before the stream is read: ZipArchive writes its central directory on dispose,
        // so calling ToArray() inside the using block returns a truncated, unopenable file.
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var table in tables)
            {
                var entry = archive.CreateEntry($"{FileNameFor(table.Name)}.csv", CompressionLevel.Optimal);
                using var entryStream = entry.Open();
                var bytes = CsvFile.Write(table.Headers, table.Rows);
                entryStream.Write(bytes, 0, bytes.Length);
            }
        }

        return stream.ToArray();
    }

    /// <summary>
    /// Every table as one object, under a small envelope saying what the file is.
    ///
    /// <para>The envelope is what makes this worth keeping rather than merely worth opening: a bare
    /// object of tables tells a reader nothing about which version of the product wrote it or when.
    /// <c>formatVersion</c> is stamped so that a reader written later can tell what it is looking
    /// at — this is an export today, and nothing reads it back, but a file that cannot be identified
    /// is a file no future importer can safely accept.</para>
    ///
    /// <para>Rows go out as objects keyed by their heading, not as positional arrays. Arrays are
    /// smaller and unreadable: a column inserted in a later version shifts every value in every row
    /// of every older file, with nothing to detect it by.</para>
    /// </summary>
    public static byte[] WriteJson(IReadOnlyList<ExportTable> tables)
    {
        var payload = new Dictionary<string, object?>
        {
            ["formatVersion"] = 1,
            ["generatedAtUtc"] = DateTime.UtcNow,
            ["tables"] = tables.ToDictionary(
                table => CamelCase(table.Name),
                table => (object)table.Rows.Select(row =>
                {
                    var record = new Dictionary<string, object?>();
                    for (var i = 0; i < table.Headers.Count; i++)
                    {
                        record[CamelCase(table.Headers[i])] = i < row.Count ? row[i] : null;
                    }

                    return record;
                }).ToList()),
        };

        return JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        // Indented, because a backup is a file a person opens to check it worked. The size cost is
        // paid once on a download, and gzip on the wire removes most of it anyway.
        WriteIndented = true,
        // Relaxed, so a shop name or a customer note containing & or an apostrophe is not written
        // as & — this file is read by people as well as by machines, and the default encoder
        // renders most non-ASCII text unreadable.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>"Cloth receipts" becomes "cloth-receipts" — safe on every filesystem inside a zip.</summary>
    private static string FileNameFor(string name)
    {
        var builder = new StringBuilder(name.Length);
        foreach (var character in name)
        {
            builder.Append(char.IsLetterOrDigit(character) ? char.ToLowerInvariant(character) : '-');
        }

        return builder.ToString().Trim('-');
    }

    /// <summary>"Order number" becomes "orderNumber", so the JSON reads like the rest of the API.</summary>
    private static string CamelCase(string name)
    {
        var words = name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (words.Length == 0)
        {
            return name;
        }

        var builder = new StringBuilder(char.ToLowerInvariant(words[0][0]) + words[0][1..].ToLowerInvariant());
        foreach (var word in words.Skip(1))
        {
            builder.Append(char.ToUpperInvariant(word[0])).Append(word[1..].ToLowerInvariant());
        }

        return builder.ToString();
    }
}
