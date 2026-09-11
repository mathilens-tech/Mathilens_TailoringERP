"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";

type SearchPickerProps<T> = {
  id: string;
  label: string;
  selectedLabel: string | null;
  onSelect: (item: T) => void;
  onClear?: () => void;
  search: (term: string, page: number, pageSize: number, token: string | null) => Promise<{ items: T[] }>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  placeholder?: string;
  /** When provided, a "create new" action appears once a search returns no results — for pickers that also need to cover records that don't exist yet (e.g. a walk-in customer). */
  onCreateNew?: (query: string) => void;
  createNewLabel?: (query: string) => string;
  /** Freezes the picker — the "Change" button disappears when a value is already selected, and the search input itself is disabled otherwise. */
  disabled?: boolean;
};

/** A debounced, server-side search dropdown for picking a related record (00_MASTER_SPEC.md § 9.7 Search). */
export function SearchPicker<T>({
  id,
  label,
  selectedLabel,
  onSelect,
  onClear,
  search,
  getId,
  getLabel,
  placeholder,
  onCreateNew,
  createNewLabel,
  disabled = false,
}: SearchPickerProps<T>) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!debouncedQuery) {
      // No direct setState here — an empty query's "no results" state is expressed at render
      // time (below) by also checking debouncedQuery, so stale results from a prior query
      // never show, without needing to actively reset them.
      return;
    }

    let cancelled = false;
    search(debouncedQuery, 1, 10, getAccessToken())
      .then(({ items }) => {
        if (!cancelled) {
          setResults(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, search]);

  if (selectedLabel) {
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-sm font-medium">{label}</span>}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span>{selectedLabel}</span>
          {onClear && !disabled && (
            <button type="button" onClick={onClear} className="text-foreground/70 hover:text-foreground">
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <input
        id={id}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isOpen && debouncedQuery && results.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {results.map((item) => (
            <li key={getId(item)}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
              >
                {getLabel(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && debouncedQuery && results.length === 0 && onCreateNew && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          <button
            type="button"
            onClick={() => {
              onCreateNew(debouncedQuery);
              setQuery("");
              setIsOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
          >
            {createNewLabel ? createNewLabel(debouncedQuery) : `+ Add "${debouncedQuery}" as new`}
          </button>
        </div>
      )}
    </div>
  );
}
