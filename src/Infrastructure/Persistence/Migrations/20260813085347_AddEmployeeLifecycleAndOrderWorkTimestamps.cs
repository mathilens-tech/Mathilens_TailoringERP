using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeLifecycleAndOrderWorkTimestamps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "WorkCompletedAtUtc",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WorkStartedAtUtc",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmploymentType",
                table: "Employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateOnly>(
                name: "JoiningDate",
                table: "Employees",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastWorkingDate",
                table: "Employees",
                type: "date",
                nullable: true);

            // Existing staff predate both columns, and EF's generated defaults are unusable for
            // them: "" is not an EmploymentType any code can read back, and 0001-01-01 would show
            // on screen as a joining date from the year one. The day the record was created is the
            // closest thing the database knows to when they joined, and Full time is the
            // overwhelming default for a tailoring shop — both are editable per employee
            // afterwards, which is why guessing here is safe and leaving them broken is not.
            //
            // The date is matched against '-infinity' as well as 0001-01-01: Npgsql maps
            // DateOnly.MinValue — which is what EF's generated default produces — onto PostgreSQL's
            // -infinity, so checking only for the literal date silently matches nothing.
            migrationBuilder.Sql("""
                UPDATE "Employees"
                SET "EmploymentType" = 'FullTime'
                WHERE "EmploymentType" IS NULL OR "EmploymentType" = '';

                UPDATE "Employees"
                SET "JoiningDate" = ("CreatedAtUtc" AT TIME ZONE 'UTC')::date
                WHERE "JoiningDate" = '-infinity'::date
                   OR "JoiningDate" = DATE '0001-01-01';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_LastWorkingDate",
                table: "Employees",
                column: "LastWorkingDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_LastWorkingDate",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "WorkCompletedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "WorkStartedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "JoiningDate",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "LastWorkingDate",
                table: "Employees");
        }
    }
}
