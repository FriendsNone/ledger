/* Stages the one build artefact www/ needs.
 *
 * Phase 1 ships the original app as a literal copy with no bundler, so it
 * reaches Capacitor's JS API through the global build of @capacitor/core
 * (window.Capacitor + registerPlugin) rather than an import. Copying it from
 * node_modules at sync time keeps it pinned to the installed version instead of
 * vendoring a snapshot into git that would quietly drift.
 *
 * Drop this once Phase 3 flips webDir to Vite's dist/.
 */
import { copyFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const from = new URL("node_modules/@capacitor/core/dist/capacitor.js", root);
const to = new URL("www/capacitor.js", root);

for (const [label, url] of [["www/index.html", new URL("www/index.html", root)], ["@capacitor/core", from]]) {
  try {
    await access(url);
  } catch {
    console.error(`prepare-www: ${label} is missing (looked in ${fileURLToPath(url)}).`);
    process.exit(1);
  }
}

await copyFile(from, to);
console.log("prepare-www: staged www/capacitor.js");
