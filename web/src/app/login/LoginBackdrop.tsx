/**
 * The woven texture inside the login page's accent band.
 *
 * Drawn in `currentColor` rather than a fixed colour, so the caller sets the tone with an ordinary
 * text utility and it works in light and dark without being written twice.
 */

/**
 * Herringbone, tiled across the accent band. A weave rather than an abstract shape: it is the one
 * motif on the page that is literally the trade, and it tiles so no edge of the band is ever a
 * partial figure however the window is sized.
 */
export function BandWeave({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        {/* A fine pitch on purpose. Tiled larger the zigzag stopped reading as cloth and became a
            row of chevrons loud enough to compete with the card sitting over it. */}
        <pattern id="loginWeave" width="22" height="22" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
            <path d="M0 11 L11 0" />
            <path d="M0 22 L11 11" />
            <path d="M11 0 L22 11" />
            <path d="M11 11 L22 22" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#loginWeave)" />
    </svg>
  );
}
