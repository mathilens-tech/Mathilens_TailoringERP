namespace MathilensERP.Domain.Orders;

/// <summary>Whether the fabric for an order item was supplied by the customer or the shop (02_DATABASE.md § 10.11) — affects billing.</summary>
public enum FabricSource
{
    CustomerSupplied,
    ShopSupplied
}
