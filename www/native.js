/* Ledger — native shell.
   Phase 1 wiring only: system-bar styling and the Android hardware back button.

   Everything here drives the app through the DOM — the same buttons a finger
   would press — so the copied app in index.html keeps its own state machine and
   needs no hooks of its own. */
(function () {
  "use strict";

  /* --- WebView capability probe -------------------------------------------
     The real floor for this app is the WebView (Chromium >= 105), not the
     Android version — System WebView updates through the Play Store on its own
     schedule, so the OS version predicts almost nothing. These two properties
     are the ones that fail *silently*: without them the toast lands half off
     screen and the flex rows lose their spacing, which reads as a broken app
     rather than an old one. Say so instead, in plain language, and let the app
     run anyway — the data is still safe and legible.

     Deliberately a feature probe, not UA sniffing: it stays correct when the
     user updates the WebView without changing anything else. */
  var capable = typeof CSS !== "undefined" && CSS.supports &&
    CSS.supports("translate", "-50% 0") && CSS.supports("selector(:has(*))");
  if (!capable) {
    /* Sits above #backupNag inside <main>, which render() never rewrites — only
       #app is re-rendered — so it survives every redraw. Custom properties are
       far below the floor being probed, so the theme still applies. */
    var warn = function () {
      var el = document.createElement("div");
      el.setAttribute("role", "alert");
      el.style.cssText = "margin:0 0 12px;padding:12px 14px;border:1px solid var(--expense,#a8442b);" +
        "border-radius:10px;background:var(--card,#fbfaf6);color:var(--ink,#221f1a);font:14px/1.45 system-ui,sans-serif";
      el.innerHTML = "<strong>This device’s browser engine is out of date.</strong><br>" +
        "Ledger works and your data is safe, but parts of the layout will look wrong. " +
        "Updating <em>Android System WebView</em> in the Play Store fixes it — or open Ledger in a browser instead.";
      var main = document.querySelector("main") || document.body;
      main.insertBefore(el, main.firstChild);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", warn);
    else warn();
  }

  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

  var capExports = window.capacitorExports || {};
  var SystemBars = capExports.SystemBars || (cap.Plugins && cap.Plugins.SystemBars);
  var StatusBar = cap.registerPlugin("StatusBar");
  var App = cap.registerPlugin("App");

  /* --- System bars ---------------------------------------------------------
     applyTheme() writes the *resolved* theme to data-theme on <html>, so
     watching that attribute handles the "system" setting for free.

     Two calls, because the two Android eras behave differently:
       · icon contrast — SystemBars, everywhere. Style Light means dark icons on
         a light bar; Dark is the reverse.
       · bar colour — only meaningful below API 35, where the system still draws
         the bars and the window is not edge-to-edge. From API 35 edge-to-edge is
         enforced, the call is ignored, and the page itself shows through.
     The theme carries a static fallback for both (see values/styles.xml); this
     is what makes the colour track the *app's* theme rather than the device's,
     which is the case the theme resource alone cannot express. The colour is
     read from the live token so it can never drift from the stylesheet. */
  function syncBars() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (SystemBars) SystemBars.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(function () {});
    var paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
    if (paper) StatusBar.setBackgroundColor({ color: paper }).catch(function () {});
  }
  new MutationObserver(syncBars).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
  syncBars();

  /* --- Android hardware back ----------------------------------------------
     Unwind what is on screen, outermost thing first, then leave the app. A
     focused input's soft keyboard is dismissed by Android before the event ever
     reaches us, which is why there is no branch for it here. */
  App.addListener("backButton", function () {
    // A modal is open — #mClose only exists while one is rendered.
    var close = document.getElementById("mClose");
    if (close) { close.click(); return; }

    // Settings and Help are overlays onto a tab; their own buttons toggle back
    // to whichever tab you came from, which is exactly the "back" behaviour.
    var settings = document.getElementById("settingsBtn");
    if (settings && settings.classList.contains("on")) { settings.click(); return; }
    var help = document.getElementById("helpBtn");
    if (help && help.classList.contains("on")) { help.click(); return; }

    // Any other tab falls back to Overview before the app exits.
    var active = document.querySelector("#tabs button.on");
    if (active && active.getAttribute("data-tab") !== "overview") {
      var overview = document.querySelector('#tabs button[data-tab="overview"]');
      if (overview) { overview.click(); return; }
    }

    App.exitApp();
  });
})();
