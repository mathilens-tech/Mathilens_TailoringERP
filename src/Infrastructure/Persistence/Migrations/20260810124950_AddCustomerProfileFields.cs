using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfBirth",
                table: "Customers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Customers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Religion",
                table: "Customers",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "WeddingDate",
                table: "Customers",
                type: "date",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Religion",
                table: "Customers",
                column: "Religion");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Customers_Religion",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Religion",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WeddingDate",
                table: "Customers");
        }
    }
}
