#!/usr/bin/env node
//
// Turns web/staticwebapp.config.json into nginx location blocks.
//
// WHY THIS EXISTS
// Every [id] route in this app prerenders a single placeholder page ("_") and depends on the host
// rewriting /dashboard/orders/<guid> onto /dashboard/orders/_.html — next.config.ts says so
// outright. Azure Static Web Apps reads those rules from staticwebapp.config.json; nginx cannot.
//
// Maintaining the same list twice is the obvious way for test and production to drift: someone
// adds a route, updates the SWA config, production works, and the test box 404s on the new page
// (or the reverse). Generating one from the other keeps a single source of truth, so adding a
// route to staticwebapp.config.json is all anybody has to remember.
//
//   node generate-nginx-routes.mjs web/staticwebapp.config.json > mathilens-routes.conf

import { readFileSync } from "node:fs";

const configPath = process.argv[2] ?? "web/staticwebapp.config.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));

const lines = [
  "# GENERATED — do not edit.",
  `# Source: ${configPath} (via deploy/test-server/generate-nginx-routes.mjs)`,
  "",
];

for (const route of config.routes ?? []) {
  // Routes with no rewrite exist in the SWA config only to stop a wildcard swallowing a real
  // static page — "/dashboard/customers/new" ahead of "/dashboard/customers/*". nginx needs no
  // equivalent: the try_files below reaches for $uri.html first, so new.html wins on its own and
  // only an id that matches no file falls through to the placeholder.
  if (!route.rewrite) {
    continue;
  }

  const prefix = route.route.replace(/\*$/, "");
  if (!prefix.endsWith("/")) {
    console.error(`Skipping ${route.route}: expected a wildcard prefix ending in "/"`);
    continue;
  }

  // ^~ so this wins outright over any regex location, and longest-prefix matching keeps
  // /dashboard/employees/ and /dashboard/employee/ apart without either shadowing the other.
  lines.push(
    `location ^~ ${prefix} {`,
    `    try_files $uri $uri.html ${route.rewrite};`,
    "}",
    "",
  );
}

if (lines.length === 3) {
  console.error("No rewrite routes found — refusing to emit an empty file.");
  process.exit(1);
}

process.stdout.write(lines.join("\n"));
