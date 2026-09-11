using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <remarks>
    /// Employee phone numbers become required here, and they are also unique. That combination has
    /// no safe automatic repair: EF's generated default turns every missing number into '', which
    /// is not a phone number, and the second such row would then collide on the unique index and
    /// fail the deployment with an error naming neither the cause nor the rows. The guard below
    /// stops first and says exactly what to fix. Check before deploying:
    ///
    /// <code>
    /// SELECT "Id", "FullName" FROM "Employees"
    ///  WHERE "IsDeleted" = false AND ("PhoneNumber" IS NULL OR btrim("PhoneNumber") = '');
    /// </code>
    ///
    /// Give each of those a real number — inventing one is a shop decision, not a migration's.
    /// </remarks>
    public partial class AddActivityDescriptionAndRequiredEmployeePhone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                DECLARE missing int;
                BEGIN
                    SELECT COUNT(*) INTO missing
                    FROM "Employees"
                    WHERE "IsDeleted" = false
                      AND ("PhoneNumber" IS NULL OR btrim("PhoneNumber") = '');

                    IF missing > 0 THEN
                        RAISE EXCEPTION
                            'Phone number is now required and unique for employees, but % active employee(s) have none. Give them a number before deploying, then re-run this migration.', missing;
                    END IF;
                END $$;
                """);

            migrationBuilder.DropIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "Employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "ActivityLogs",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees",
                column: "PhoneNumber",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "ActivityLogs");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "Employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_PhoneNumber",
                table: "Employees",
                column: "PhoneNumber",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"PhoneNumber\" IS NOT NULL");
        }
    }
}
