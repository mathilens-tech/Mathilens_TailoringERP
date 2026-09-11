/**
 * The shop this build of the ERP is customised for.
 *
 * One value, read in one place. A new customer is a build setting — `NEXT_PUBLIC_CUSTOMER_NAME=ABC
 * Textiles` — rather than an edit to the login screen, which is why the name never appears as a
 * literal anywhere a component can see it.
 *
 * This is the name the login screen wears: staff signing in work for the shop, not for the company
 * that wrote the software, which keeps its credit in the footer.
 *
 * Deliberately not the shop name from Settings: that one is per-shop data behind the API, and the
 * login screen is the one place in the app where nobody is signed in yet to read it. Baked in at
 * build time, which suits a per-customer deployment — this app ships as a static export, so there
 * is no server left at runtime to look anything up.
 *
 * The fallback is the current deployment, so a build that forgets the variable still says something
 * true rather than showing an empty wordmark.
 */
export const CUSTOMER_NAME = process.env.NEXT_PUBLIC_CUSTOMER_NAME?.trim() || "Radha Men's";
