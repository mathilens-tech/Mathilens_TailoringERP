using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Gives every invoice a reference of its own — "INV-2026-0001" — counted per year.
    ///
    /// Ordered deliberately: the column arrives, the counter table is created, existing invoices are
    /// numbered oldest first within their year, the counters are seeded past that backfill, and only
    /// then is the unique index added. Adding the index first would have it police rows the backfill
    /// has not reached yet.
    /// </summary>
    /// <inheritdoc />
    public partial class AddInvoiceNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "Invoices",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            // One row per year, holding the last number handed out. Not an EF entity: nothing reads
            // it as data, and the generator's single upsert-and-return statement is the only thing
            // that ever touches it.
            migrationBuilder.Sql("""
                CREATE TABLE "InvoiceNumberCounters" (
                    "Year" integer NOT NULL PRIMARY KEY,
                    "LastNumber" integer NOT NULL
                );
                """);

            // AT TIME ZONE 'UTC' rather than a bare EXTRACT: CreatedAtUtc is a timestamptz, so an
            // unqualified extract reads it in whatever timezone the session happens to have, and the
            // year in the number has to match the one the generator will compute from UtcNow.
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT
                        "Id",
                        EXTRACT(YEAR FROM "CreatedAtUtc" AT TIME ZONE 'UTC')::int AS "Year",
                        ROW_NUMBER() OVER (
                            PARTITION BY EXTRACT(YEAR FROM "CreatedAtUtc" AT TIME ZONE 'UTC')
                            ORDER BY "CreatedAtUtc", "Id"
                        ) AS "Seq"
                    FROM "Invoices"
                )
                UPDATE "Invoices" i
                SET "InvoiceNumber" =
                    UPPER(COALESCE(NULLIF(TRIM((SELECT "Value" FROM "Settings" WHERE "Key" = 'Invoice.NumberPrefix')), ''), 'INV'))
                    || '-' || n."Year"::text
                    || '-' || LPAD(n."Seq"::text, 4, '0')
                FROM numbered n
                WHERE i."Id" = n."Id";
                """);

            // Seeded from what the backfill just used, so the next invoice of each year continues
            // rather than colliding with one already issued.
            migrationBuilder.Sql("""
                INSERT INTO "InvoiceNumberCounters" ("Year", "LastNumber")
                SELECT
                    EXTRACT(YEAR FROM "CreatedAtUtc" AT TIME ZONE 'UTC')::int,
                    COUNT(*)::int
                FROM "Invoices"
                GROUP BY EXTRACT(YEAR FROM "CreatedAtUtc" AT TIME ZONE 'UTC')::int;
                """);

            // Filtered, so a blank can never block the next invoice. An unfiltered unique index on a
            // defaulted-empty column is what took ordering down on the live site when the schema went
            // out ahead of the code; the same shape is not repeated here.
            migrationBuilder.CreateIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true,
                filter: "\"InvoiceNumber\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices");

            migrationBuilder.Sql("""DROP TABLE IF EXISTS "InvoiceNumberCounters";""");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "Invoices");
        }
    }
}
