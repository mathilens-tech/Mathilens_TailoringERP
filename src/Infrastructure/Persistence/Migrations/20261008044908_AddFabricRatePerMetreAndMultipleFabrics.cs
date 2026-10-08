using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFabricRatePerMetreAndMultipleFabrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FabricDetails_OrderItemId",
                table: "FabricDetails");

            migrationBuilder.AddColumn<decimal>(
                name: "RatePerMetre",
                table: "FabricDetails",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_FabricDetails_OrderItemId",
                table: "FabricDetails",
                column: "OrderItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FabricDetails_OrderItemId",
                table: "FabricDetails");

            migrationBuilder.DropColumn(
                name: "RatePerMetre",
                table: "FabricDetails");

            migrationBuilder.CreateIndex(
                name: "IX_FabricDetails_OrderItemId",
                table: "FabricDetails",
                column: "OrderItemId",
                unique: true);
        }
    }
}
