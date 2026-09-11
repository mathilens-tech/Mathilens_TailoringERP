"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

type ThemeChoice = "light" | "dark";

type Palette = {
  background: string;
  surface: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
};

/**
 * Hard-coded rather than read from the CSS variables, because both cards have to show their own
 * scheme at once. The variables only ever hold the active theme, so a preview built from them would
 * render two identical cards. These track globals.css; a palette change there wants echoing here.
 */
const PALETTES: Record<ThemeChoice, Palette> = {
  light: {
    background: "#f6f7fb",
    surface: "#ffffff",
    border: "#e3e5ec",
    foreground: "#16181d",
    muted: "#d7dae4",
    primary: "#4f46e5",
  },
  dark: {
    background: "#0a0b0f",
    surface: "#16181f",
    border: "#262a35",
    foreground: "#ededf1",
    muted: "#343a49",
    primary: "#6366f1",
  },
};

const OPTIONS: { value: ThemeChoice; label: string; detail: string }[] = [
  { value: "light", label: "Light", detail: "Best in a bright shop" },
  { value: "dark", label: "Dark", detail: "Easier on the eyes at night" },
];

/**
 * Repaints the app without writing anything down.
 *
 * next-themes' own setTheme would persist immediately, which is the one thing a preview must not
 * do. This touches exactly what it touches — the class the `dark` variant keys off, and the
 * colour-scheme hint that tells the browser how to paint scrollbars and form controls — so a
 * preview and a saved theme are visually identical, and nothing is left behind if the preview is
 * abandoned.
 */
function paint(next: ThemeChoice) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(next);
  root.style.colorScheme = next;
}

const subscribeNoop = () => () => {};

/** Avoids a hydration mismatch: the resolved theme is only known client-side. */
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/**
 * Light and dark as two previews: picking one repaints the app at once, Save makes it stick.
 *
 * <p>The preview is the point. A card is a thumbnail an inch across, and nobody can tell from that
 * whether they will want to read invoices in it all afternoon — so the choice is shown on the real
 * screen, at full size, before it is committed to.</p>
 *
 * <p>Leaving without saving puts the previous theme back, on unmount. Otherwise "Save" would be
 * decoration: the app would already be wearing the new theme and would keep wearing it, and the
 * button would only decide whether that survived a reload — which is not what a person pressing
 * Save is being told.</p>
 *
 * <p>Saved per device via next-themes (localStorage), not against the account, so the tablet on the
 * shop floor and the desktop in the office can differ.</p>
 */
export function ThemePicker() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();
  const isClient = useIsClient();

  // Null until a card is picked, so the selection falls through to whatever is actually showing
  // without an effect copying one into the other.
  const [picked, setPicked] = useState<ThemeChoice | null>(null);
  const active: ThemeChoice = resolvedTheme === "dark" ? "dark" : "light";
  const choice = picked ?? active;

  // Refs rather than state: nothing here should trigger a render, and the unmount cleanup below
  // must read the values as they are when it runs, not as they were when the effect was created.
  const isPreviewing = useRef(false);
  const restoreTo = useRef<ThemeChoice>(active);

  // "system" is not one of the two cards, so it counts as nothing saved: whichever card is showing,
  // saving it is a real change because it stops the app following the device. Hence the note below.
  const saved = theme === "light" || theme === "dark" ? theme : null;
  const isFollowingDevice = saved === null;
  const isDirty = choice !== saved;

  // Cleanup only, so it never runs on mount and never sets state — it just undoes an abandoned
  // preview when the screen goes away.
  useEffect(
    () => () => {
      if (isPreviewing.current) {
        paint(restoreTo.current);
      }
    },
    [],
  );

  function handleSelect(next: ThemeChoice) {
    // Captured on the first pick of a run, before anything is repainted: after that, `active`
    // reflects the preview rather than what the user actually had.
    if (!isPreviewing.current) {
      isPreviewing.current = true;
      restoreTo.current = active;
    }

    setPicked(next);
    paint(next);
  }

  function handleSave() {
    setTheme(choice);
    isPreviewing.current = false;
    showToast(`${choice === "dark" ? "Dark" : "Light"} theme saved.`);
  }

  // The cards are colour, and colour is the whole point of them — so the skeleton keeps their exact
  // footprint rather than collapsing, which would shift the Save button under the cursor on hydrate.
  if (!isClient) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <div key={option.value} className="h-[188px] rounded-lg border border-border bg-surface" />
          ))}
        </div>
        <div className="h-9" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Real radios in labels rather than buttons with aria-checked: arrow-key movement between
          the two, and the "one of a set" reading, both come free and correct. */}
      <fieldset className="border-0 p-0">
        <legend className="sr-only">Theme</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const isSelected = choice === option.value;

            return (
              <label
                key={option.value}
                className={`group cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                  isSelected ? "border-primary bg-surface" : "border-border bg-surface hover:bg-surface-hover"
                } focus-within:ring-2 focus-within:ring-primary/40`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => handleSelect(option.value)}
                  className="sr-only"
                />

                <ThemePreview palette={PALETTES[option.value]} />

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">{option.label}</span>
                    <p className="text-xs text-foreground/60">{option.detail}</p>
                  </div>

                  {/* A tick as well as the outline: an outline alone is a single colour cue, and
                      this screen is the one a colour-blind user is most likely to be on. */}
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none ${
                      isSelected ? "bg-primary text-primary-foreground" : "border border-border"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={!isDirty}>
          Save
        </Button>

        {/* Says which of the two states you are in, because they look identical: the app is already
            wearing the theme either way, and only this line distinguishes trying it from keeping it. */}
        <p className="text-xs text-foreground/60" role="status">
          {isDirty
            ? isFollowingDevice
              ? "Following your device for now. Save to keep this on this device."
              : "Previewing. Save to keep it, or leave this page to go back."
            : "Saved on this device."}
        </p>
      </div>
    </div>
  );
}

/** A miniature of the app — sidebar, heading, a few rows — so the choice is recognisable at a glance. */
function ThemePreview({ palette }: { palette: Palette }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-28 overflow-hidden rounded-md border"
      style={{ backgroundColor: palette.background, borderColor: palette.border }}
    >
      <div
        className="flex w-1/4 flex-col gap-1.5 p-2"
        style={{ backgroundColor: palette.surface, borderRight: `1px solid ${palette.border}` }}
      >
        <span className="h-1.5 w-4/5 rounded-full" style={{ backgroundColor: palette.primary }} />
        <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: palette.muted }} />
        <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: palette.muted }} />
        <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: palette.muted }} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <span className="h-2 w-2/5 rounded-full" style={{ backgroundColor: palette.foreground }} />

        <div
          className="flex flex-1 flex-col gap-1.5 rounded p-1.5"
          style={{ backgroundColor: palette.surface, border: `1px solid ${palette.border}` }}
        >
          <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: palette.muted }} />
          <span className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: palette.muted }} />
          <span className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: palette.muted }} />
        </div>
      </div>
    </div>
  );
}
