import type { BusinessMode } from "@/lib/api/business-mode";

/**
 * What kind of order is being written — the question the counter answers first.
 *
 * This is a property of the order, not of the shop: the same shop sells a length of cloth to one
 * customer and stitches a suit from the customer's own material for the next, sometimes within the
 * hour. `BusinessMode` answers the different question of whether the shop sells cloth at all, and
 * so decides which of these three are on offer — see {@link isKindAvailable}.
 *
 * The three were always here, but only as a two-button toggle for the sale and a per-item Shop /
 * Customer fabric choice buried in the rows, so "am I billing for cloth?" was answered in two
 * different places and neither was named. Each is now its own screen, asking only for what that
 * kind of order actually has.
 */
export type OrderKind = "fabric" | "tailoring" | "fabricTailoring";

export type OrderKindMeta = {
  kind: OrderKind;
  /** Path segment under /dashboard/orders/new. */
  slug: string;
  /** What the shop calls it. */
  label: string;
  /** The one line that tells staff whether this is the screen they want. */
  description: string;
  /** Who supplies the cloth — the distinction the three names turn on. */
  fabricNote: string;
  /**
   * Whether choosing this means the shop is selling cloth, and so whether it may be offered at all.
   * A tailoring-only shop has no cloth to sell, so both fabric kinds are hidden from it entirely
   * rather than offered and then refused.
   */
  requiresFabricTrade: boolean;
};

export const ORDER_KINDS: readonly OrderKindMeta[] = [
  {
    kind: "fabric",
    slug: "fabric",
    label: "Fabric order",
    description: "Cloth sold over the counter, with nothing to stitch.",
    fabricNote: "Shop's cloth. No garment, no tailor, no collection date — it is paid for and taken.",
    requiresFabricTrade: true,
  },
  {
    kind: "tailoring",
    slug: "tailoring",
    label: "Tailoring order",
    description: "The customer brings their own material and pays for the stitching.",
    fabricNote: "Customer's cloth. The bill is the stitching only.",
    requiresFabricTrade: false,
  },
  {
    kind: "fabricTailoring",
    slug: "fabric-tailoring",
    label: "Fabric + Tailoring",
    description: "Cloth from the shop, made up into a garment.",
    fabricNote: "Shop's cloth. The bill carries both the cloth and the stitching.",
    requiresFabricTrade: true,
  },
];

export function orderKindMeta(kind: OrderKind): OrderKindMeta {
  // Non-null: ORDER_KINDS covers every member of the union, and the type stops a fourth appearing
  // here without an entry being added above.
  return ORDER_KINDS.find((meta) => meta.kind === kind)!;
}

/** Whether this shop may write this kind of order at all. */
export function isKindAvailable(kind: OrderKind, mode: BusinessMode): boolean {
  return !orderKindMeta(kind).requiresFabricTrade || mode === "tailoringFabric";
}

export function availableKinds(mode: BusinessMode): readonly OrderKindMeta[] {
  return ORDER_KINDS.filter((meta) => isKindAvailable(meta.kind, mode));
}

/**
 * The business mode the *form* should price and render against, which is not always the shop's.
 *
 * A tailoring order is stitching on the customer's own cloth, so it is priced as tailoring-only even
 * in a shop that sells fabric — otherwise the item rows would ask whose cloth it is when the screen
 * has already answered that. The two fabric kinds always price as a fabric shop, because both are
 * only reachable in one.
 */
export function effectiveBusinessMode(kind: OrderKind): BusinessMode {
  return kind === "tailoring" ? "tailoring" : "tailoringFabric";
}

/** Cloth with nothing being stitched — hides the garment, quantity and stitching fields. */
export function isFabricOnly(kind: OrderKind): boolean {
  return kind === "fabric";
}

/** Whose cloth the garment is cut from — the shop's own roll, or one the customer walked in with. */
export type FabricSourceMode = "internal" | "external";

/**
 * Whose cloth a new item row assumes, before anybody touches the toggle.
 *
 * The shop's own, on every kind of order. The customer's used to be the default on the grounds that
 * it needs nothing else filled in, so a row started complete — but that optimised for the form
 * rather than for the counter, where the shop supplying the cloth is the ordinary case and the
 * customer walking in with their own is the exception. Defaulting to the exception meant the toggle
 * was flipped on almost every row of almost every order.
 *
 * A constant rather than a function of the kind. It did vary by kind for a moment, and saying so in
 * a signature that now ignores its argument would only invite the reader to hunt for a distinction
 * that is no longer drawn. Where the choice is not offered at all — the Tailoring screen, which
 * prices as tailoring-only — this value is never read: `sellsFabric` is false there, so the item is
 * submitted with no fabric at all and nothing untrue is stored.
 */
export const DEFAULT_FABRIC_SOURCE: FabricSourceMode = "internal";
