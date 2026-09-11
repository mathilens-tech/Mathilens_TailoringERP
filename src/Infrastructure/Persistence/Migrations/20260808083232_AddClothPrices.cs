using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClothPrices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClothPrices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClothCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ClothName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CostPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    SellingPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
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
                    table.PrimaryKey("PK_ClothPrices", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClothPrices_ClothCode",
                table: "ClothPrices",
                column: "ClothCode");

            migrationBuilder.CreateIndex(
                name: "IX_ClothPrices_IsDeleted",
                table: "ClothPrices",
                column: "IsDeleted");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClothPrices");
        }
    }
}
