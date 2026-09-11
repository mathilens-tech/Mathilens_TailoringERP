using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkOrderFabricToClothForStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClothCode",
                table: "FabricDetails",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClothPriceId",
                table: "FabricDetails",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "FabricDetails",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Fabric recorded before this column existed has no unit, and EF's generated "" is not
            // a ClothUnit any code can read back — the row would fail to materialise. Metres is
            // the unit the quantity was always implicitly in, so it is a statement of what those
            // rows already meant rather than a guess.
            migrationBuilder.Sql("""
                UPDATE "FabricDetails"
                SET "Unit" = 'Metres'
                WHERE "Unit" IS NULL OR "Unit" = '';
                """);

            // ClothPriceId is deliberately left null on existing rows. Matching old free-text
            // cloth codes to catalogue entries after the fact would silently invent consumption
            // history; those orders simply predate stock tracking and are excluded from it.
            migrationBuilder.CreateIndex(
                name: "IX_FabricDetails_ClothPriceId",
                table: "FabricDetails",
                column: "ClothPriceId",
                filter: "\"ClothPriceId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FabricDetails_ClothPriceId",
                table: "FabricDetails");

            migrationBuilder.DropColumn(
                name: "ClothCode",
                table: "FabricDetails");

            migrationBuilder.DropColumn(
                name: "ClothPriceId",
                table: "FabricDetails");

            migrationBuilder.DropColumn(
                name: "Unit",
                table: "FabricDetails");
        }
    }
}
