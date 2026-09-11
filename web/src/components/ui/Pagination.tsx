import type { PaginationMeta } from "@/lib/api-client";
import { Button } from "./Button";

/** Small enough to scan, large enough to avoid paging through a season's orders one screen at a time. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 20;

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Omit to hide the page-size selector — for lists whose size the caller fixes. */
  onPageSizeChange?: (pageSize: number) => void;
};

/** 00_MASTER_SPEC.md § 9.6 Tables — pagination consistent with the § 8.3 API contract. */
export function Pagination({ meta, onPageChange, onPageSizeChange }: PaginationProps) {
  // The row count matters even on a single page — it's how staff see how many orders are open —
  // so only the page buttons disappear when there's nothing to page through.
  const hasPages = meta.totalPages > 1;

  if (!hasPages && !onPageSizeChange) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/70">
      <div className="flex flex-wrap items-center gap-4">
        <span>
          Page {meta.page} of {meta.totalPages} ({meta.totalCount} total)
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={meta.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {hasPages && (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
            Previous
          </Button>
          <Button type="button" variant="secondary" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
