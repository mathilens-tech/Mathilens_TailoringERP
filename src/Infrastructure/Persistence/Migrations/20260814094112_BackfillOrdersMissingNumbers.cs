using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Gives a number to any order that has none.
    ///
    /// AddOrderNumbers numbered every order that existed when it ran, but the schema went live ahead
    /// of the code that fills the column. An order taken in that window was inserted by an API that
    /// had never heard of order numbers, so Postgres applied the column default — an empty string.
    /// The unique index is unfiltered, so exactly one such row is possible and the next order placed
    /// on that site is rejected. This clears the row and lets ordering resume.
    ///
    /// Written as a migration rather than run by hand because any environment whose schema moved
    /// ahead of its code hit the same window and needs the same repair.
    /// </summary>
    /// <inheritdoc />
    public partial class BackfillOrdersMissingNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Numbers come from the same sequence and the same prefix the running app uses, so a
            // repaired order is indistinguishable from one numbered normally. nextval is evaluated
            // per row, so two orders in this state cannot collide.
            migrationBuilder.Sql("""
                UPDATE "Orders"
                SET "OrderNumber" =
                    COALESCE((SELECT "Value" FROM "Settings" WHERE "Key" = 'Orders.NumberPrefix'), 'ORD')
                    || '-' || LPAD(nextval('"OrderNumberSequence"')::text, 4, '0')
                WHERE "OrderNumber" IS NULL OR "OrderNumber" = '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty. Taking these numbers back would blank a reference the shop may
            // already have written on a job card, to restore a state that broke ordering.
        }
    }
}
