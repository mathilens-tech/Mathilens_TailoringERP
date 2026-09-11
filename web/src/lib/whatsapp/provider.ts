/**
 * How a WhatsApp message reaches a customer.
 *
 * Today there is one provider and it is a person: the shop opens WhatsApp with the message already
 * typed and presses Send themselves. That is a deliberate choice, not a stopgap for a missing
 * integration — nothing is dispatched on the shop's behalf, and nothing claims it was.
 *
 * The interface exists so that when a Business API provider is added (AiSensy, or Meta's own —
 * `MetaWhatsAppSender` already exists on the server for the latter), it slots in beside this one
 * rather than through it. Note what the shape forbids: a provider is handed a finished message and
 * a finished number. It does not compose text, it does not know what an invoice is, and it cannot
 * reach the order. So the day delivery changes, `buildInvoiceMessage` below does not.
 */
export type WhatsAppDelivery = {
  /** What to call this provider where a person has to choose or read one. */
  readonly name: string;

  /**
   * Whether the shop finishes the job by hand.
   *
   * Read by the UI, which must not promise more than the provider does: a manual provider gets a
   * button that says it opens WhatsApp, and no "sent" state anywhere afterwards.
   */
  readonly isManual: boolean;

  /**
   * Hand the message over.
   *
   * Resolves once the message has been *handed to* the provider — for the manual one, that is the
   * moment WhatsApp opens, which is emphatically not the moment anything is delivered. A provider
   * that genuinely sends may resolve on the API's acknowledgement; neither is a delivery receipt,
   * and no caller should treat it as one.
   */
  deliver(phoneNumber: string, message: string): Promise<void>;
};

/** Thrown when the browser refuses to open the tab — almost always a pop-up blocker. */
export class WhatsAppOpenError extends Error {
  constructor() {
    super("Unable to open WhatsApp. Please allow pop-ups for this site and try again.");
    this.name = "WhatsAppOpenError";
  }
}

/**
 * Which of the two WhatsApp apps a share should open.
 *
 * A phone can have both installed, and they both claim `wa.me` — so the link alone cannot say which
 * one is meant, and Android picks. Worse, it picks *permanently* the first time someone taps
 * "Always" in the chooser, so a shop that once opened a WhatsApp link in the personal app is stuck
 * sending customer invoices from it. This is what that choice is overridden with.
 */
export type WhatsAppApp = "business" | "standard";

/**
 * Android package names, which is the only thing that actually distinguishes the two apps.
 *
 * `w4b` is "WhatsApp for Business" — the id the app was published under and has kept since.
 */
const ANDROID_PACKAGES: Record<WhatsAppApp, string> = {
  business: "com.whatsapp.w4b",
  standard: "com.whatsapp",
};

/**
 * Business, because a shop is who this ERP is for and a shop's number lives on the Business app.
 *
 * Safe as a default even where it is wrong: a phone without the Business app falls through to the
 * plain wa.me link (see `buildAndroidIntentUrl`), which opens whatever WhatsApp is there.
 */
export const DEFAULT_WHATSAPP_APP: WhatsAppApp = "business";

/** Reads the stored setting, which is a free-text value like any other, into one of the two apps. */
export function toWhatsAppApp(value: string | null | undefined): WhatsAppApp {
  return value?.trim().toLowerCase() === "standard" ? "standard" : DEFAULT_WHATSAPP_APP;
}

/**
 * Whether this is a phone that can be told which app to open.
 *
 * Android only, and deliberately so. iOS has no equivalent: both apps register the same universal
 * links and the same `whatsapp://` scheme, and no URL a web page can produce chooses between them.
 * Desktop has no such app to choose. Both get the plain wa.me link, exactly as before.
 *
 * <p>Android *and Chromium*, because `intent://` is a Chromium feature rather than an Android one.
 * Chrome, Samsung Internet, Edge and Opera all handle it; Firefox for Android does not, and would
 * be handed a URL its engine simply cannot follow — a dead button, where the plain wa.me link at
 * least opens something. So a browser that cannot use an intent is not given one.</p>
 */
function canChooseWhatsAppApp(): boolean {
  if (typeof navigator === "undefined" || !/android/i.test(navigator.userAgent)) {
    return false;
  }

  // Chrome and CriOS cover Chrome itself; the other three are the Chromium browsers a shop is
  // realistically using instead. Firefox ("FxiOS"/"Firefox") matches none of them and falls through.
  return /Chrome|CriOS|SamsungBrowser|EdgA|OPR/i.test(navigator.userAgent);
}

/**
 * The Click-to-Chat provider: build the link, open it in a new tab, let the shop press Send.
 *
 * No API key, no account, no approval, and no dependency — the link is a plain URL that hands off to
 * whichever WhatsApp the machine already has, desktop app or web.
 *
 * A factory rather than a single object because the app to open is a shop setting, and `deliver`
 * takes only a number and a message on purpose. The preference is bound here, where the provider is
 * chosen, instead of widening the interface every caller implements.
 */
export function createManualWhatsAppProvider(
  preferredApp: WhatsAppApp = DEFAULT_WHATSAPP_APP,
): WhatsAppDelivery {
  return {
    name: "Manual WhatsApp",
    isManual: true,

    async deliver(phoneNumber: string, message: string): Promise<void> {
      const url = buildShareUrl(phoneNumber, message, preferredApp);

      if (canChooseWhatsAppApp()) {
        // An intent URL has to be a top-level navigation in the tab the shop is already in.
        //
        // It used to go through window.open(url, "_blank"), and that is why naming the package never
        // worked: Chrome cannot process a non-http scheme in a tab it has just opened blank, so
        // rather than failing visibly it took the one route that looks like success and followed
        // S.browser_fallback_url — the plain wa.me link, which is exactly the link that opens
        // whichever WhatsApp holds the "Always" default. The package was correct all along and was
        // never given the chance to apply.
        //
        // A synthetic anchor click rather than assigning location.href: it keeps the user gesture
        // the caller is careful to preserve, which is what stops Chrome treating this as an unasked
        // for redirect to an app.
        const link = document.createElement("a");
        link.href = url;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      // Desktop and iOS get wa.me in a new tab, unchanged. noopener,noreferrer: without them the
      // opened tab gets a handle on this one through window.opener and could navigate the ERP
      // somewhere else. _blank keeps the shop's page where it is, which the flow depends on — staff
      // go back to it after pressing Send.
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        throw new WhatsAppOpenError();
      }
    },
  };
}

/** The default provider, for callers with no preference of their own to pass. */
export const manualWhatsAppProvider: WhatsAppDelivery = createManualWhatsAppProvider();

/**
 * `https://wa.me/<digits>?text=<encoded>`.
 *
 * The message goes through encodeURIComponent, which is what makes an order note containing &, #,
 * + or a line of Tamil arrive as itself rather than truncating the message at the first ampersand.
 * Exported so it can be shown and checked without opening anything.
 *
 * Names no app, and cannot: this is the link both of them answer.
 */
export function buildClickToChatUrl(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * The same message, addressed to one named Android app instead of to whichever one won the chooser.
 *
 * An Android intent URL carries the target package alongside the link, so `com.whatsapp.w4b` opens
 * the Business app even on a phone where the personal app was set as the default handler for
 * wa.me — which is the whole reason this exists.
 *
 * `S.browser_fallback_url` is what keeps that safe. If the named app is not installed, nothing on
 * the phone answers the intent, and Chrome follows the fallback to the ordinary wa.me link instead
 * of dead-ending or bouncing the shop to the Play Store. So a phone with only one WhatsApp on it
 * still works, whichever one that is, without anybody configuring anything.
 *
 * Encoded twice on that fallback, deliberately: the wa.me URL already contains a percent-encoded
 * message, and it is then encoded again as a value inside the intent. A space arrives as %2520
 * here and as a space in WhatsApp.
 */
export function buildAndroidIntentUrl(
  phoneNumber: string,
  message: string,
  preferredApp: WhatsAppApp,
): string {
  // encodeURIComponent escapes # and ; among the rest, so neither a message containing one nor the
  // `#Intent;...;end` grammar below can be broken by what a customer's order notes happen to say.
  const query = `phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
  const fallback = encodeURIComponent(buildClickToChatUrl(phoneNumber, message));

  return (
    `intent://send?${query}` +
    `#Intent;scheme=whatsapp;package=${ANDROID_PACKAGES[preferredApp]};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

/**
 * The link to actually open, for this device.
 *
 * The intent form is used for both apps on Android, not just Business: naming the package is what
 * bypasses a remembered "Always" choice, so it is equally what a shop needs to get *back* to the
 * personal app once one has been set. Everywhere else this is the wa.me link and nothing has
 * changed.
 */
export function buildShareUrl(
  phoneNumber: string,
  message: string,
  preferredApp: WhatsAppApp = DEFAULT_WHATSAPP_APP,
): string {
  return canChooseWhatsAppApp()
    ? buildAndroidIntentUrl(phoneNumber, message, preferredApp)
    : buildClickToChatUrl(phoneNumber, message);
}
