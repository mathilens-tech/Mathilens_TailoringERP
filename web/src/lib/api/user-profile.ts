import { deleteSetting, getSetting, upsertSetting } from "@/lib/api/settings";

/**
 * One key per person — `User.Photo.<id>` — holding their picture as a data URI.
 *
 * The settings store is the only place a shop-wide value can be kept without a new endpoint, and it
 * caps a value at 4000 characters (UpsertSettingCommandValidator). That is the entire reason
 * toAvatarDataUrl exists: a photo straight off a phone is a megabyte, and has to be reduced to
 * something that fits before it can be stored at all.
 */
export const USER_PHOTO_KEY_PREFIX = "User.Photo.";

export function userPhotoKey(userId: string): string {
  return `${USER_PHOTO_KEY_PREFIX}${userId}`;
}

/** The server's ceiling on a setting value, with room left for the envelope. */
const MAX_PHOTO_CHARS = 3900;

/** Avatars render at 40px at most, so 96 covers a 2× screen with nothing to spare wasted. */
const AVATAR_PIXELS = 96;

/**
 * A picture file reduced to a square data URI small enough to store.
 *
 * Drawn centre-cropped at 96px and re-encoded as JPEG, dropping quality until it fits the settings
 * store's 4000-character limit. Rejects rather than storing a truncated string — half a data URI is
 * a broken image, not a smaller one.
 */
export function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_PIXELS;
      canvas.height = AVATAR_PIXELS;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser cannot resize the image."));
        return;
      }

      // Centre crop to a square, so a portrait photo keeps the face rather than being squashed.
      const side = Math.min(image.width, image.height);
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_PIXELS,
        AVATAR_PIXELS,
      );

      for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= MAX_PHOTO_CHARS) {
          resolve(dataUrl);
          return;
        }
      }

      reject(new Error("That picture could not be made small enough to store. Try a simpler image."));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as a picture."));
    };

    image.src = url;
  });
}

/** Their picture, or null if they have not set one. Never rejects — no photo is not an error. */
export async function getUserPhoto(userId: string, token: string | null): Promise<string | null> {
  try {
    const setting = await getSetting(userPhotoKey(userId), token);
    return setting.value || null;
  } catch {
    // A 404 is the ordinary answer for somebody who has never uploaded one.
    return null;
  }
}

export function setUserPhoto(userId: string, dataUrl: string, token: string | null): Promise<unknown> {
  return upsertSetting(userPhotoKey(userId), dataUrl, token);
}

export function removeUserPhoto(userId: string, token: string | null): Promise<void> {
  return deleteSetting(userPhotoKey(userId), token);
}

/**
 * Their initials for the photo placeholder.
 *
 * Takes whatever the screen shows them as — a name where the account has one, the email where it
 * does not. Splitting on spaces as well as the separators an address uses is what makes both work
 * from one rule: "Kavitha R" and "kavitha.r@shop.com" both give KR.
 */
export function initialsFor(nameOrEmail: string | null): string {
  const name = (nameOrEmail ?? "").trim();
  if (!name) {
    return "?";
  }
  const [local] = name.split("@");
  const parts = local.split(/[\s.\-_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
  return letters.toUpperCase();
}
