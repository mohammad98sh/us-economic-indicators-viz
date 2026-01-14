document.addEventListener("DOMContentLoaded", () => {
  const statusLine = document.getElementById("statusLine");
  const libs = document.getElementById("statusLibs");
  const debugMsg = document.getElementById("debugMsg");

  statusLine.textContent = "script.js is running ✅";

  const okVega = typeof vega !== "undefined";
  const okVL = typeof vegaLite !== "undefined";
  const okEmbed = typeof vegaEmbed !== "undefined";

  libs.textContent = `vega: ${okVega ? "OK" : "MISSING"} | vegaLite: ${okVL ? "OK" : "MISSING"} | vegaEmbed: ${okEmbed ? "OK" : "MISSING"}`;

  debugMsg.textContent = "If vegaEmbed is MISSING, the CDN is blocked or not loaded.";
});
