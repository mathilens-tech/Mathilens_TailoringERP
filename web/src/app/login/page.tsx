"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiPost, ApiError } from "@/lib/api-client";
import { storeTokens, type AuthTokens } from "@/lib/auth";
import { USER_NAME_MIN_LENGTH } from "@/lib/api/users";
import { CUSTOMER_NAME } from "@/lib/customer";
import { fieldWithAdornmentClassName, labelClassName } from "./fieldStyles";
import { BandWeave } from "./LoginBackdrop";
import { ChoosePasswordForm } from "./ChoosePasswordForm";
import { ResetCodeForm } from "./ResetCodeForm";
import { SessionEndedNotice } from "./SessionEndedNotice";

/*
  The wordmark's two-tone treatment, applied to whatever the shop is called: everything up to the
  last space in the text colour, the last word in the brand purple — "Radha Fabric", "ABC Textiles".

  Split rather than hardcoded because the name is a per-deployment setting. A single-word name has
  no tail to colour, and colouring the whole of it would make the mark a different thing on one
  customer's screen than on another's, so it stays whole.
*/
const lastSpace = CUSTOMER_NAME.lastIndexOf(" ");
const customerHead = lastSpace === -1 ? CUSTOMER_NAME : CUSTOMER_NAME.slice(0, lastSpace);
const customerTail = lastSpace === -1 ? "" : CUSTOMER_NAME.slice(lastSpace + 1);

function validate(userName: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedUserName = userName.trim();

  /* Keyed "username", not "userName": a field error coming back from the server arrives as
     FluentValidation's "UserName" and is lowercased before it lands in this same map. Two spellings
     would leave a server-side message with no field to sit under. */
  if (!trimmedUserName) {
    errors.username = "Username is required.";
  } else if (trimmedUserName.length < USER_NAME_MIN_LENGTH) {
    errors.username = `Username must be at least ${USER_NAME_MIN_LENGTH} characters.`;
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
}

/**
 * What the user is told when signing in fails.
 *
 * Three different failures, three different answers — the point being that "Incorrect username or
 * password" is a lie when the phone is off the Wi-Fi, and sends the user off retyping a password
 * that was right all along.
 *
 * Wrong credentials get one message whether the username exists or not, which is the server's
 * behaviour too: it answers Auth.InvalidCredentials for an unknown username and a wrong password
 * alike. A locked account is deliberately allowed through with the server's own wording — being
 * told to wait is the only thing that helps, and repeating "incorrect password" to someone whose
 * password is correct just earns more failed attempts.
 */
function failureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    // fetch itself rejected: no response, so there is nothing to have got wrong but the connection.
    return "Unable to connect to the server. Please try again.";
  }

  if (error.code === "Auth.InvalidCredentials") {
    return "Incorrect username or password.";
  }

  // Anything unexpected, including a body that could not be parsed, is the app's problem to word —
  // never the server's raw one, which is where stack traces and internals leak out.
  if (error.status >= 500 || error.code === "UNKNOWN_ERROR") {
    return "Something went wrong. Please try again.";
  }

  return error.message;
}

export default function LoginPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  /* State lags a fast double-tap: two taps inside one React render both see isSubmitting as false
     and both post. The ref is set synchronously, so the second tap sees the first. */
  const submittingRef = useRef(false);
  // Reached only by URL, never shown automatically — see ResetCodeForm for why an email address
  // alone must not open a password-setting flow.
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  // Signed in successfully, but on a password somebody else chose. Not a failure — the sign-in
  // worked, and the tokens are already stored; this is the step between it and the dashboard.
  const [mustChangePassword, setMustChangePassword] = useState(false);

  /*
    The one-time reset code an Owner issues is redeemed here, at /login?reset=1.

    There is no link to it on the screen by design: the shop hands the code over in person, and the
    login screen stays a login screen. Read from window.location rather than useSearchParams so the
    page keeps rendering statically — the same reason SessionEndedNotice is its own component.
  */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRedeeming(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const errors = validate(userName, password);
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      // Straight to the field that needs fixing — on a phone the message can easily be under the
      // keyboard, and focusing it both scrolls it into view and says it to a screen reader.
      (errors.username ? userNameRef : passwordRef).current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const tokens = await apiPost<AuthTokens>("/api/v1/auth/login", { userName: userName.trim(), password });
      storeTokens(tokens);

      /*
        Signed in on a password an Owner issued and read out loud. The credential did its job —
        proving who this is — but it is known to at least one other person, so it is not what should
        be guarding the account tomorrow.

        Held on this screen rather than bounced to a settings page: the temporary password is still
        in `password` here, and the change-password endpoint needs it as the current one. Sending
        them to /dashboard first would mean asking them to type it again on a screen that had no
        reason to know it.
      */
      if (tokens.mustChangePassword) {
        submittingRef.current = false;
        setIsSubmitting(false);
        setMustChangePassword(true);
        return;
      }

      router.push("/dashboard");
      // Left in its loading state deliberately: the navigation is still in flight, and dropping
      // back to "Login" for those few hundred milliseconds reads as though nothing happened.
    } catch (error) {
      submittingRef.current = false;
      setIsSubmitting(false);

      if (error instanceof ApiError && error.details) {
        setFieldErrors(
          Object.fromEntries(error.details.map((d) => [d.field.toLowerCase(), d.message])),
        );
      }
      setFormError(failureMessage(error));
    }
  }

  return (
    /*
      One screen and no scrollbar on a desktop, where the layout is designed around the card sitting
      on the seam between the panel and the band and there is room for all of it.

      On a phone it is min-height instead: the card is the whole page there, and clipping the Login
      button off the bottom of a short handset is a worse outcome than a short scroll. That is also
      what lets the on-screen keyboard work — the page simply gets shorter than its content and
      scrolls, where a fixed height would trap the button underneath. dvh rather than vh because a
      phone's retracting address bar makes 100vh taller than what is on show.
    */
    <main className="relative flex min-h-dvh flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {/*
        The machine fills the left of the page, the accent band the right, and the card straddles the
        seam between them — which is what gives the layout its depth, so both are backdrops here
        rather than columns in the flow.

        The panel is held light in both themes rather than following the background: the artwork is
        a black machine on white, so on a dark background it would be a glaring white slab with an
        invisible machine in the middle of it.
      */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[74%] bg-[#f6f4f0] lg:block" />

      {/* Black, sampled from the machine's own body rather than picked by eye, so the band and the
          artwork read as one palette. The brand colour still carries on the tile, the wordmark and
          the Continue button — all on white, where it works. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[26%] bg-[#222124] lg:block">
        <BandWeave className="h-full w-full text-white/[0.08]" />
      </div>

      {/*
        The right padding is what makes the card straddle the band rather than sit on top of it:
        roughly two thirds of the card wants to be over the page and a third over the accent, and
        with the band 26% wide that lands the card's right edge around 16% in from the edge.
      */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-6 sm:px-5 lg:justify-between lg:gap-8 lg:px-12 lg:py-0 lg:pr-[16%] xl:px-20 xl:pr-[16%]">
        {/*
          The machine sits in the flow rather than in the panel behind it, so it centres in the gap
          actually left beside the card. Positioned in the panel with a fixed percentage padding it
          could only be centred at one window width — the card's edge moves as the viewport changes,
          and the machine drifted off-centre everywhere else.

          Vertically it needs nothing: it and the card are siblings under items-center, so both are
          middle-aligned on the same line.
        */}
        <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          {/*
            A plain img, not next/image: this app builds with `output: "export"`, where the image
            optimiser needs a loader that is not configured.

            The source login.png was opaque white with no alpha, which showed as a white rectangle on
            the warm panel. It is served here as a WebP with the background cleared to transparent —
            which also cuts it from 1.1 MB to 36 KB, the white having carried compression noise that
            PNG could not squeeze.
          */}
          {/* Two ceilings at once, hence min(): 28rem keeps it compact on a wide screen, and 100%
              keeps it inside its column on a narrow one. With only the rem cap it stayed 28rem on a
              1024-wide tablet and slid under the card, which clipped the handwheel. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/login.webp"
            alt=""
            className="max-h-[46%] w-auto max-w-[min(28rem,100%)] object-contain"
          />
        </div>

        {/* ---- Sign-in card ---- */}
        <div className="w-full max-w-[30rem] shrink-0 rounded-xl border border-border bg-surface px-5 py-7 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] sm:px-10 sm:py-9">
          <div className="flex flex-col items-center text-center">
            {/*
              The machine, on a phone.

              Below lg the artwork beside the card is hidden — there is no room for a column next to
              the form — which left the one thing on the page that says what the shop does absent
              from the view most staff actually sign in on. Here it sits above the wordmark instead,
              small enough to cost the form nothing. Smaller again on the shortest handsets, where
              every row above the Login button is one the thumb has to scroll past.

              Held on a light plate in both themes for the same reason the wide layout's panel is:
              the source is a black machine on a transparent background, and on the dark surface it
              would be a silhouette in a hole.
            */}
            {/* Its own asset, not the one the wide layout uses: this is the icon.png supplied for
                the phone, converted the same way login.webp was — near-white background cleared to
                alpha, then cut to 360px tall, which is the largest phone rendering (80px) at 3x.
                862 KB of PNG became 18 KB of WebP; the original is unusable over a shop's mobile
                data, and its opaque background would have shown as a white slab on the plate. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- output: "export" has no image optimiser configured */}
            <img
              src="/icon.webp"
              alt=""
              className="mb-4 h-16 w-auto max-w-full rounded-lg bg-[#f6f4f0] object-contain px-3 py-2 sm:h-20 lg:hidden"
            />
            {/* The shop's own name is the wordmark — staff signing in work for the shop, not for the
                company that wrote the software, which keeps its credit in the footer. No monogram
                tile above it either: on the wide layout the machine beside the card is already the
                page's mark, and a second logo said the same thing twice. */}
            <p className="text-lg font-bold tracking-tight">
              {customerHead}
              {customerTail && (
                <>
                  {" "}
                  <span className="text-primary">{customerTail}</span>
                </>
              )}
            </p>
          </div>

          {/* The card has two jobs and one heading, so the heading says which one is on screen —
              "Set your password" over a form asking for credentials is an instruction for a form
              that isn't there. */}
          <h1 className="mt-6 text-center text-xl font-semibold tracking-tight">
            {mustChangePassword ? "Choose your password" : isRedeeming ? "Set your password" : "Sign in to your account"}
          </h1>
          {/* Only the reset flow gets a line under the heading, and only because it is a real
              instruction: without it the code form never says where the code comes from. Sign-in had
              one too — "Enter your credentials to continue" — but it told the reader nothing the two
              labelled fields below it do not, so it is gone rather than merely hidden. */}
          {isRedeeming && (
            <p className="mt-1.5 text-center text-sm text-foreground/70">
              Enter the code the shop owner gave you, then choose your own password.
            </p>
          )}
          {mustChangePassword && (
            <p className="mt-1.5 text-center text-sm text-foreground/70">
              You signed in with the password the shop owner gave you. Choose one only you know.
            </p>
          )}

          {mustChangePassword ? (
            <ChoosePasswordForm temporaryPassword={password} onDone={() => router.push("/dashboard")} />
          ) : isRedeeming ? (
            <ResetCodeForm
              onDone={() => {
                setIsRedeeming(false);
                setRedeemed(true);
              }}
              onCancel={() => setIsRedeeming(false)}
            />
          ) : (
            <>
              {!redeemed && (
                <Suspense fallback={null}>
                  <SessionEndedNotice />
                </Suspense>
              )}
              {redeemed && (
                <p className="mt-5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  Password set. Sign in with it below.
                </p>
              )}
              <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
                <div>
                  <label htmlFor="username" className={labelClassName}>
                    Username
                  </label>
                  <div className="relative">
                    <input
                      ref={userNameRef}
                      id="username"
                      name="username"
                      type="text"
                      /* A plain keyboard, and none of the helpfulness that turns "anita" into
                         "Anita" on the way in — a username is matched case-insensitively, but
                         autocorrect rewriting it mid-word is not. */
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      required
                      placeholder="Enter your username"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      disabled={isSubmitting}
                      className={fieldWithAdornmentClassName}
                      aria-invalid={Boolean(fieldErrors.username)}
                      aria-describedby={fieldErrors.username ? "username-error" : undefined}
                    />
                    {/* A person, where the envelope used to be: the field no longer asks for an
                        address, and an envelope beside it would still be saying that it does. */}
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/40"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      <path
                        d="M4.5 19.5a7.5 7.5 0 0 1 15 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  {fieldErrors.username && (
                    <p id="username-error" className="mt-1.5 text-sm text-danger">
                      {fieldErrors.username}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className={labelClassName}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      /* Only matter once the password is revealed — at which point it is an ordinary
                         text field, and the keyboard would otherwise capitalise and correct it. */
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className={fieldWithAdornmentClassName}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    />
                    {/* Typing a password on an on-screen keyboard is easy to get wrong and
                        impossible to check — so it can be revealed, on the device holding it.

                        A 44px square, not the icon's 20: the tap target has to be a thumb's worth,
                        and it sits inside the field's 48px height rather than growing it. */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      disabled={isSubmitting}
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path
                          d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        {!showPassword && (
                          <path d="M4 20 L20 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        )}
                      </svg>
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="password-error" className="mt-1.5 text-sm text-danger">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {formError && (
                  <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {formError}
                  </p>
                )}

                {/* Full width where the screen is a phone and the thumb is the pointer; the compact
                    centred button the wider layout was drawn around from sm up. */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 text-base sm:mx-auto sm:w-auto sm:px-12"
                >
                  {isSubmitting && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
                      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {isSubmitting ? "Signing in…" : "Login"}
                </Button>
              </form>
            </>
          )}

          {/*
            Nothing below the button by design. There is no "Forgot Password?", no "Sign in with
            Google" and no "Create an account" — none of the three exists: password resets are done
            by an Owner from Users, the API accepts a username and password only, and accounts are handed
            out rather than self-registered, so who can sign in stays a decision the shop makes.

            The /register route is still deliberately routable — it is how the first Owner account is
            created on a fresh database, when nobody exists yet to grant access.
          */}
        </div>
      </div>

      {/* In the flow, not pinned: on a short handset with the keyboard up it should scroll away
          under the card rather than sit on top of it.

          Over the page background on a narrow screen, over the light left panel on a wide one — so
          on lg it needs an explicit dark, not the theme's foreground, which is near-white in dark
          mode and would vanish against the panel.

          The safe-area inset is what keeps it clear of the home indicator on a tall iPhone. It
          resolves to 0 on everything else, including this app today, and costs nothing there. */}
      <footer className="relative shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs text-foreground/60 lg:text-black/55">
        © {new Date().getFullYear()} Mathilens Tailoring ERP. All rights reserved.
      </footer>
    </main>
  );
}
