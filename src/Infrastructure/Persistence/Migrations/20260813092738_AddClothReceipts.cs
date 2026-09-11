using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClothReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClothReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClothPriceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClothCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ClothName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    Unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReceivedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    SupplierName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    RatePerUnit = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_ClothReceipts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClothReceipts_ClothPriceId",
                table: "ClothReceipts",
                column: "ClothPriceId");

            migrationBuilder.CreateIndex(
                name: "IX_ClothReceipts_IsDeleted",
                table: "ClothReceipts",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_ClothReceipts_ReceivedOn",
                table: "ClothReceipts",
                column: "ReceivedOn");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClothReceipts");
        }
    }
}
