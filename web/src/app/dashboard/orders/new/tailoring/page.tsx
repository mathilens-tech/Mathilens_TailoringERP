"use client";

import { OrderKindScreen } from "../OrderKindScreen";

/** The customer's own material, made up by the shop. The bill is the stitching only. */
export default function NewTailoringOrderPage() {
  return <OrderKindScreen kind="tailoring" />;
}
