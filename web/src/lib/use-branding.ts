"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getBranding, EMPTY_BRANDING, type Branding } from "@/lib/api/branding";

/** #rgb or #rrggbb — anything else is ignored rather than written into the stylesheet unchecked. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function darken(hex: string, amount: number): string {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(full.slice(start, start + 2), 16);
    return Math.max(0, Math.round(value * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

/**
 * Loads the shop's branding and applies its colour to the CSS custom properties the whole theme
 * already reads from, so one setting recolours every button, link and badge without any component
 * knowing branding exists.
 */
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);

  const load = useCallback(async () => {
    setBranding(await getBranding(getAccessToken()).catch(() => EMPTY_BRANDING));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const color = branding.primaryColor.trim();
    if (!HEX_COLOR.test(color)) {
      return;
    }

    // Set on the root element, where they override the stylesheet's defaults for both themes.
    const root = document.documentElement;
    root.style.setProperty("--primary", color);
    root.style.setProperty("--primary-hover", darken(color, 0.15));

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-hover");
    };
  }, [branding.primaryColor]);

  return branding;
}
