import { ThemePicker } from "./ThemePicker";

/**
 * Light or dark mode.
 *
 * Deliberately behind no permission at all, unlike its siblings under Settings. Front Desk and
 * Tailor hold no Settings.View, so gating this the way Order Duration is gated would leave them
 * with no way to change the theme anywhere in the app — the toggle that used to sit in the header
 * is gone. Nothing here touches shop data; it is a per-device display preference.
 */
export default function AppearanceSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Appearance</h1>

      <div className="flex max-w-xl flex-col gap-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <h2 className="text-lg font-semibold">Theme</h2>
          <p className="text-sm text-foreground/70">
            Pick a look and press Save. This is remembered on this device only, so each person can
            set their own.
          </p>
        </div>

        <ThemePicker />
      </div>
    </div>
  );
}
