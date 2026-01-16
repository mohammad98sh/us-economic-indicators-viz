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
  const rows = parseCSV(text);
  return rows;
}

// Minimal CSV parser (handles commas, no quotes needed for this dataset)
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
  // Ensure types
  return rows.map(r => ({
    date: r.date, // keep as ISO string
    gdp_billions: toNumber(r.gdp_billions),
    gdp_growth_yoy: toNumber(r.gdp_growth_yoy),
    unemployment_rate: toNumber(r.unemployment_rate),
    inflation_yoy: toNumber(r.inflation_yoy)
  })).filter(r => r.date);
}

/**
 * Crosshair layer:
 * - use a single selection name per chart
 * - uses nearest + mouseover (NOT raw vega signals)
 * - rules + tooltip text
 */
function crosshairLayer({xField, yField, xType="temporal", yType="quantitative", selectionName="hover"}) {
  return {
    layer: [
      // Main line/points should be provided by caller in layer[0]
      // Here we provide crosshair & tooltip layers.
      {
        params: [{
          name: selectionName,
          select: { type: "point", fields: [xField], nearest: true, on: "pointermove", clear: "pointerout" }
        }]
      },
      {
        mark: { type: "rule" },
        encoding: {
          x: { field: xField, type: xType },
          opacity: {
            condition: { param: selectionName, value: 0.35 },
            value: 0
          }
        }
      },
      {
        mark: { type: "rule" },
        encoding: {
          y: { field: yField, type: yType },
          opacity: {
            condition: { param: selectionName, value: 0.35 },
            value: 0
          }
        }
      },
      {
        mark: { type: "point", filled: true, size: 60 },
        encoding: {
          x: { field: xField, type: xType },
          y: { field: yField, type: yType },
          opacity: {
            condition: { param: selectionName, value: 1 },
            value: 0
          }
        }
      }
    ]
  };
}

function baseConfig(title) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: title, fontSize: 12, anchor: "start", offset: 10 },
    width: "container",
    height: 240,
    data: { url: DATA_URL },
    config: {
      axis: { labelFontSize: 11, titleFontSize: 11, grid: true },
      view: { stroke: null }
    }
  };
}

function lineWithCrosshair({title, yField, yTitle, selectionName}) {
  const spec = baseConfig(title);
  spec.layer = [
    {
      mark: { type: "line", strokeWidth: 2 },
      encoding: {
        x: { field: "date", type: "temporal", title: "Date" },
        y: { field: yField, type: "quantitative", title: yTitle }
      }
    },
    // add crosshair/point layers
    ...crosshairLayer({
      xField: "date",
      yField,
      xType: "temporal",
      yType: "quantitative",
      selectionName
    }).layer.slice(1), // skip empty param-only layer (we'll insert params on first layer below)
  ];

  // Put the selection on the first layer (prevents duplicate signals)
  spec.layer[0].params = [{
    name: selectionName,
    select: { type: "point", fields: ["date"], nearest: true, on: "pointermove", clear: "pointerout" }
  }];

  // Tooltips on hover
  spec.layer[0].encoding.tooltip = [
    { field: "date", type: "temporal", title: "Date" },
    { field: yField, type: "quantitative", title: yTitle, format: ".2f" }
  ];

  return spec;
}

function scatterWithCrosshair() {
  const spec = baseConfig("Inflation vs Unemployment (quarterly points)");
  spec.height = 280;

  spec.mark = { type: "point", filled: true, size: 60 };
  spec.params = [{
    name: "hover_scatter",
    select: { type: "point", fields: ["date"], nearest: true, on: "pointermove", clear: "pointerout" }
  }];

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

  // Add crosshair rules for scatter: vertical rule at x, horizontal at y using the selection
  spec.layer = [
    { ...spec }, // base scatter as first layer
    {
      mark: { type: "rule" },
      encoding: {
        x: { field: "unemployment_rate", type: "quantitative" },
        opacity: { condition: { param: "hover_scatter", value: 0.35 }, value: 0 }
      }
    },
    {
      mark: { type: "rule" },
      encoding: {
        y: { field: "inflation_yoy", type: "quantitative" },
        opacity: { condition: { param: "hover_scatter", value: 0.35 }, value: 0 }
      }
    }
  ];

  // Remove top-level schema duplication inside layer
  delete spec.layer[0].layer;

  return { ...spec, mark: undefined, encoding: undefined, params: undefined, title: spec.title, width: spec.width, height: spec.height, data: spec.data, config: spec.config };
}

async function renderAll() {
  try {
    setStatus(true, "Loading…");
    const rows = normalizeRows(await loadCSV());
    setStatus(true, `Done ✅ (${rows.length} rows)`, "vega: OK | vegaLite: OK | vegaEmbed: OK");

    // Charts (IMPORTANT: use correct container IDs)
    await vegaEmbed("#chartUnemp", lineWithCrosshair({
      title: "Unemployment rate (quarterly)",
      yField: "unemployment_rate",
      yTitle: "Unemployment (%)",
      selectionName: "hover_unemp"
    }), { actions: false });

    await vegaEmbed("#chartInfl", lineWithCrosshair({
      title: "Inflation (YoY, quarterly)",
      yField: "inflation_yoy",
      yTitle: "Inflation YoY (%)",
      selectionName: "hover_infl"
    }), { actions: false });

    await vegaEmbed("#chartScatter", scatterWithCrosshair(), { actions: false });

    await vegaEmbed("#chartGDPLevel", lineWithCrosshair({
      title: "GDP level (billions, quarterly)",
      yField: "gdp_billions",
      yTitle: "GDP (billions)",
      selectionName: "hover_gdp_level"
    }), { actions: false });

    await vegaEmbed("#chartGDPYoY", lineWithCrosshair({
      title: "GDP growth (YoY %, quarterly)",
      yField: "gdp_growth_yoy",
      yTitle: "GDP YoY (%)",
      selectionName: "hover_gdp_yoy"
    }), { actions: false });

    // Table preview (first 25 rows)
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
  const head = `
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
  `;
  const bodyRows = rows.slice(0, limit).map(r => {
    return `<tr>${cols.map(c => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`;
  }).join("");

  container.innerHTML = `<table>${head}<tbody>${bodyRows}</tbody></table>`;
  meta.textContent = `Columns: ${cols.join(", ")}. Showing first ${Math.min(limit, rows.length)} rows.`;
}

renderAll();
