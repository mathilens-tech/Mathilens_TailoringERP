/**
 * The look of a text field on the signed-out screens, in one place — the login form and the reset-
 * code form had grown their own copies, which is how one of them ends up a few pixels short of a
 * tap target after the other is fixed.
 */

/*
  min-h-12 (48px), not padding alone: this is the phone-sized tap target, and it has to hold
  whether the field is showing one line of 16px text or nothing at all.

  text-base rather than the text-sm the rest of the app uses. iOS Safari zooms the page in on any
  input whose text is smaller than 16px, and it does not zoom back out afterwards — the shop is left
  scrolling sideways through a login screen that was the right width a moment earlier.
*/
export const fieldClassName =
  "w-full min-h-12 rounded-md border border-border bg-surface py-3 px-4 text-base text-foreground outline-none transition-colors " +
  // Medium contrast, per the hierarchy: entered text is full-strength foreground, the placeholder
  // sits below it. It can afford to, because every field here has a real visible label — the
  // placeholder repeats the label rather than carrying anything of its own.
  "placeholder:text-foreground/60 " +
  "focus:border-primary focus:ring-2 focus:ring-primary/30 " +
  "aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger/30 " +
  "disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/60";

/** The same field with room at the right for an icon or the show-password button. */
export const fieldWithAdornmentClassName = `${fieldClassName} pr-12`;

export const labelClassName = "mb-1.5 block text-sm font-medium text-foreground";
