"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  listMeasurementTemplates,
  type GarmentType,
  type MeasurementPoint,
  type MeasurementTemplate,
} from "@/lib/api/measurements";

type TemplateMap = Partial<Record<GarmentType, readonly MeasurementPoint[]>>;

/**
 * Templates are shop-level configuration that changes about once a year, and both the New Order
 * screen and the customer measurement form need them the moment they render. Caching the one
 * request at module scope keeps that from becoming a fetch per mount — and keeps the New Order
 * screen from flashing an empty measurement panel every time a different item is clicked.
 */
let cache: TemplateMap | null = null;
let inFlight: Promise<TemplateMap> | null = null;
const subscribers = new Set<(templates: TemplateMap) => void>();

function toMap(templates: MeasurementTemplate[]): TemplateMap {
  return Object.fromEntries(templates.map((t) => [t.garmentType, t.points]));
}

async function load(): Promise<TemplateMap> {
  if (cache) {
    return cache;
  }
  inFlight ??= listMeasurementTemplates(getAccessToken())
    .then((templates) => {
      cache = toMap(templates);
      return cache;
    })
    // An unreachable API leaves the fields empty rather than the screen broken; the next mount
    // retries, since nothing was cached.
    .catch(() => ({}) as TemplateMap)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Call after saving a template so open screens pick up the new points without a reload. */
export function invalidateMeasurementTemplates() {
  cache = null;
  inFlight = null;
  // Subscribers keep showing the previous points until the replacement arrives — a blank list in
  // between would look like the template had been deleted.
  void load().then((templates) => {
    for (const notify of subscribers) {
      notify(templates);
    }
  });
}

/** Every garment type's points, keyed by garment type. Empty until the first load resolves. */
export function useMeasurementTemplates(): { templates: TemplateMap; isLoading: boolean } {
  const [templates, setTemplates] = useState<TemplateMap>(() => cache ?? {});
  const [isLoading, setIsLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;

    subscribers.add(setTemplates);
    load().then((loaded) => {
      if (!cancelled) {
        setTemplates(loaded);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscribers.delete(setTemplates);
    };
  }, []);

  return { templates, isLoading };
}

/** Shared so "no fields" keeps a stable identity — callers use it as an effect dependency. */
const NO_FIELDS: readonly MeasurementPoint[] = [];

/** One garment type's points, in the shop's configured order, each with the kind of answer it takes. */
export function useMeasurementFields(garmentType: GarmentType | null): {
  fields: readonly MeasurementPoint[];
  isLoading: boolean;
} {
  const { templates, isLoading } = useMeasurementTemplates();
  const fields = (garmentType ? templates[garmentType] : null) ?? NO_FIELDS;
  return { fields, isLoading };
}
