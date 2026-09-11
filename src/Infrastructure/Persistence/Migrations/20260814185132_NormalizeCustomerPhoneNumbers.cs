using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Rewrites existing customer phone numbers into the canonical <c>+91XXXXXXXXXX</c> form the
    /// application now stores (FR-01).
    ///
    /// <para>Until now a number was stored however it was typed, so the same customer could be
    /// "8220070363" on one record and "+918220070363" on another and neither the uniqueness check
    /// nor the spreadsheet import would see them as the same person. New writes normalize; these
    /// are the rows that predate the rule.</para>
    ///
    /// <para><b>It deliberately does not convert everything.</b> Two rows can normalize to the same
    /// number, and <c>IX_Customers_PhoneNumber</c> is unique over live rows — converting both would
    /// abort the migration, and a migration that fails on startup takes the API down with it. A
    /// number already held by another live customer, or claimed by two rows at once, is therefore
    /// left exactly as it is for someone to merge by hand. Same for anything that isn't a
    /// recognizable Indian mobile number: a 9-digit number is a broken record, and guessing at the
    /// missing digit would turn it into a plausible wrong one.</para>
    ///
    /// <para>Re-running changes nothing: a row already in canonical form is excluded by the
    /// "value actually differs" condition.</para>
    /// </summary>
    /// <inheritdoc />
    public partial class NormalizeCustomerPhoneNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Mirrors Shared/Contact/IndianPhoneNumber.cs. The two are separate expressions of one
            // rule — if that file's rules change, a new migration is how existing rows follow.
            migrationBuilder.Sql("""
                WITH cleaned AS (
                    SELECT "Id",
                           "PhoneNumber" AS current_value,
                           regexp_replace("PhoneNumber", '[[:space:]\-()]', '', 'g') AS compact
                    FROM "Customers"
                    WHERE "IsDeleted" = false
                ),
                normalized AS (
                    SELECT "Id",
                           current_value,
                           CASE
                               -- Only a bare number or one already carrying '+' is converted; a
                               -- letter or a second number in the field means this was never one
                               -- phone number, and stripping the difference would invent one.
                               WHEN compact !~ '^\+?[0-9]+$' THEN NULL
                               WHEN regexp_replace(compact, '^\+', '') ~ '^[0-9]{10}$'
                                   THEN '+91' || regexp_replace(compact, '^\+', '')
                               WHEN regexp_replace(compact, '^\+', '') ~ '^91[0-9]{10}$'
                                   THEN '+' || regexp_replace(compact, '^\+', '')
                               WHEN regexp_replace(compact, '^\+', '') ~ '^0[0-9]{10}$'
                                   THEN '+91' || substring(regexp_replace(compact, '^\+', '') from 2)
                               ELSE NULL
                           END AS canonical
                    FROM cleaned
                )
                UPDATE "Customers" c
                SET "PhoneNumber" = n.canonical
                FROM normalized n
                WHERE c."Id" = n."Id"
                  AND n.canonical IS NOT NULL
                  AND n.canonical <> n.current_value
                  -- Already held by a different live customer. Postgres evaluates this against the
                  -- pre-update snapshot, so a row whose canonical form equals another row's
                  -- untouched current value is correctly left alone.
                  AND NOT EXISTS (
                      SELECT 1 FROM "Customers" other
                      WHERE other."IsDeleted" = false
                        AND other."Id" <> c."Id"
                        AND other."PhoneNumber" = n.canonical)
                  -- Two rows converging on one number, where neither holds it yet. Without this
                  -- both would be updated and the unique index would reject the second.
                  AND NOT EXISTS (
                      SELECT 1 FROM normalized dup
                      WHERE dup."Id" <> n."Id"
                        AND dup.canonical = n.canonical);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty. The shapes these numbers were typed in were not recorded, so
            // there is nothing to put back — and putting it back would restore the ambiguity the
            // uniqueness check depends on being gone.
        }
    }
}
