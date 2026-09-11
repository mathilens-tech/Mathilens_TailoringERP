using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Gives every order a reference the shop can say out loud — "MTL-0001".
    ///
    /// The order of operations matters and is not what the scaffolder produced. The column arrives
    /// with an empty default, so adding the unique index before backfilling would collide on the
    /// second existing order and abort the deployment. Backfill first, index last.
    /// </summary>
    public partial class AddOrderNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "Orders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            // The counter itself. A sequence rather than a counter row because Postgres gives a
            // sequence value to exactly one caller, which is the whole guarantee an order number
            // needs — see OrderNumberGenerator.
            migrationBuilder.Sql("""
                CREATE SEQUENCE "OrderNumberSequence" AS bigint START WITH 1 INCREMENT BY 1;
                """);

            // Oldest order becomes 0001. Ordered by creation with the id breaking ties, so the
            // numbering is reproducible rather than dependent on how Postgres happens to return rows.
            // Soft-deleted orders are numbered too: they are part of the shop's history, and skipping
            // them would leave gaps that look like lost paperwork.
            //
            // The prefix is read from the setting if the shop has already chosen one, so a code set
            // before this deploys is honoured rather than overwritten with the fallback.
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "CreatedAtUtc", "Id") AS seq
                    FROM "Orders"
                )
                UPDATE "Orders" AS o
                SET "OrderNumber" =
                    COALESCE(
                        (SELECT NULLIF(BTRIM(s."Value"), '') FROM "Settings" AS s WHERE s."Key" = 'Orders.NumberPrefix'),
                        'ORD')
                    || '-' || LPAD(numbered.seq::text, 4, '0')
                FROM numbered
                WHERE o."Id" = numbered."Id";
                """);

            // Start the sequence after the backfill so the next order continues the series instead of
            // colliding with 0001. The third argument is is_called: with rows present, the next value
            // is count + 1; with none, setval(1, false) makes the very first order 0001.
            migrationBuilder.Sql("""
                SELECT setval(
                    '"OrderNumberSequence"',
                    GREATEST((SELECT COUNT(*) FROM "Orders"), 1),
                    (SELECT COUNT(*) FROM "Orders") > 0);
                """);

            // Unfiltered, unlike the soft-delete-aware unique indexes elsewhere: a number is never
            // handed back out, even once its order is deleted.
            migrationBuilder.CreateIndex(
                name: "IX_Orders_OrderNumber",
                table: "Orders",
                column: "OrderNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_OrderNumber",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "Orders");

            migrationBuilder.Sql("""DROP SEQUENCE IF EXISTS "OrderNumberSequence";""");
        }
    }
}
