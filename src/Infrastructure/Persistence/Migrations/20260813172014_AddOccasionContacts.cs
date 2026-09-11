using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOccasionContacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OccasionContacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Occasion = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    OccasionYear = table.Column<int>(type: "integer", nullable: false),
                    ContactedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Remarks = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    LastModifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OccasionContacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OccasionContacts_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OccasionContacts_ContactedOn",
                table: "OccasionContacts",
                column: "ContactedOn");

            migrationBuilder.CreateIndex(
                name: "IX_OccasionContacts_CustomerId_Occasion_OccasionYear",
                table: "OccasionContacts",
                columns: new[] { "CustomerId", "Occasion", "OccasionYear" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_OccasionContacts_IsDeleted",
                table: "OccasionContacts",
                column: "IsDeleted");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OccasionContacts");
        }
    }
}
