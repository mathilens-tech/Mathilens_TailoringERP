using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Two of the indexes here are unique over data that was previously unconstrained, so this
    /// migration fails on an existing database that already violates them. Check before deploying:
    /// <code>
    /// SELECT "PhoneNumber", COUNT(*) FROM "Customers"
    ///   WHERE "IsDeleted" = false GROUP BY "PhoneNumber" HAVING COUNT(*) > 1;
    /// SELECT "PhoneNumber", COUNT(*) FROM "Employees"
    ///   WHERE "IsDeleted" = false AND "PhoneNumber" IS NOT NULL
    ///   GROUP BY "PhoneNumber" HAVING COUNT(*) > 1;
    /// </code>
    /// Any rows returned have to be merged or corrected first — deciding which duplicate is the
    /// real customer is a shop decision, not something a migration should guess at.
    /// </remarks>
    public partial class AddEmployeeCodeAndUniqueContactIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Customers_PhoneNumber",
                table: "Customers");

            migrationBuilder.AddColumn<string>(
                name: "EmployeeCode",
                table: "Employees",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            // Existing staff predate the code, and the column's "" default would make every one of
            // them collide on the unique index below. They are numbered in the order they were
            // added, which is the order a shop would have assigned codes anyway; the shop can
            // rename any of them afterwards from the Employees screen.
            migrationBuilder.Sql("""
                WITH numbered AS (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "CreatedAtUtc", "Id") AS rn
                    FROM "Employees"
                )
                UPDATE "Employees" e
                SET "EmployeeCode" = 'EMP-' || LPAD(numbered.rn::text, 3, '0')
                FROM numbered
                WHERE e."Id" = numbered."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_EmployeeCode",
                table: "Employees",
                column: "EmployeeCode",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees",
                column: "PhoneNumber",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"PhoneNumber\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_PhoneNumber",
                table: "Customers",
                column: "PhoneNumber",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_EmployeeCode",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Customers_PhoneNumber",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "EmployeeCode",
                table: "Employees");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_PhoneNumber",
                table: "Customers",
                column: "PhoneNumber");
        }
    }
}
