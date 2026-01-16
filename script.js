const DATA_URL = "data/us_economic_indicators.csv";

const statusEl = document.getElementById("status");
const statusDetailEl = document.getElementById("statusDetail");

function setStatus(ok, msg, detail="") {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? "#0f766e" : "#b91c1c";
  statusDetailEl.textContent = detail;
}

async function loadCSV() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parseCSV(text);
}

// Minimal CSV parser (works for simple numeric CSV without quoted commas)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(s => s.trim());
  const rows = [];
  for (let i=1; i<lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length !== headers.length) continue;
    const obj = {};
    for (let j=0; j<headers.length; j++) obj[headers[j]] = parts[j];
    rows.push(obj);
  }
  return rows;
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeRows(rows) {
  return rows.map(r => ({
    date: r.date,
    gdp_billions: toNumber(r.gdp_billions),
    gdp_growth_yoy: toNumber(r.gdp_growth_yoy),
    unemployment_rate: toNumber(r.unemployment_rate),
    inflation_yoy: toNumber(r.inflation_yoy)
  })).filter(r => r.date);
}

/**
 * Minimal chart config: no gridlines, clean axes.
 */
function baseConfig(title, height=240) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: title, fontSize: 12, anchor: "start", offset: 10 },
    width: "container",
    height,
    data: { url: DATA_URL },
    config: {
      axis: {
        grid: false,
        labelFontSize: 11,
        titleFontSize: 11,
        tickSize: 4
      },
      view: { stroke: null }
    }
  };
}

function lineSpec({ title, yField, yTitle }) {
  const spec = baseConfig(title, 240);
  spec.mark = { type: "line", strokeWidth: 2 };
  spec.encoding = {
    x: { field: "date", type: "temporal", title: "Date" },
    y: { field: yField, type: "quantitative", title: yTitle },
    tooltip: [
      { field: "date", type: "temporal", title: "Date" },
      { field: yField, type: "quantitative", title: yTitle, format: ".2f" }
    ]
  };
  return spec;
}

function scatterSpec() {
  const spec = baseConfig("Inflation vs Unemployment (quarterly points)", 280);
  spec.mark = { type: "point", filled: true, size: 60 };
  spec.encoding = {
    x: { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
    y: { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
    color: { field: "date", type: "temporal", title: "Year", timeUnit: "year" },
    tooltip: [
      { field: "date", type: "temporal", title: "Date" },
      { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)", format: ".2f" },
      { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)", format: ".2f" }
    ]
  };
  return spec;
}

async function renderAll() {
  try {
    setStatus(true, "Loading…");

    const rows = normalizeRows(await loadCSV());
    setStatus(true, `Done ✅ (${rows.length} rows)`, "vega: OK | vegaLite: OK | vegaEmbed: OK");

    await vegaEmbed("#chartUnemp", lineSpec({
      title: "Unemployment rate (quarterly)",
      yField: "unemployment_rate",
      yTitle: "Unemployment (%)"
    }), { actions: false });

    await vegaEmbed("#chartInfl", lineSpec({
      title: "Inflation (YoY, quarterly)",
      yField: "inflation_yoy",
      yTitle: "Inflation YoY (%)"
    }), { actions: false });

    await vegaEmbed("#chartScatter", scatterSpec(), { actions: false });

    await vegaEmbed("#chartGDPLevel", lineSpec({
      title: "GDP level (billions, quarterly)",
      yField: "gdp_billions",
      yTitle: "GDP (billions)"
    }), { actions: false });

    await vegaEmbed("#chartGDPYoY", lineSpec({
      title: "GDP growth (YoY %, quarterly)",
      yField: "gdp_growth_yoy",
      yTitle: "GDP YoY (%)"
    }), { actions: false });

    renderTable(rows, 25);

  } catch (err) {
    console.error(err);
    setStatus(false, "Error ❌", String(err.message || err));
  }
}

function renderTable(rows, limit=25) {
  const container = document.getElementById("tableContainer");
  const meta = document.getElementById("tableMeta");
  if (!rows.length) {
    container.textContent = "No data";
    return;
  }
  const cols = Object.keys(rows[0]);

  const head = `<thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>`;
  const body = rows.slice(0, limit).map(r =>
    `<tr>${cols.map(c => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`
  ).join("");

  container.innerHTML = `<table>${head}<tbody>${body}</tbody></table>`;
  meta.textContent = `Columns: ${cols.join(", ")}. Showing first ${Math.min(limit, rows.length)} rows.`;
}

renderAll();
