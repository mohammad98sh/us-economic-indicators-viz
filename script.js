function debug(msg){
  const el = document.getElementById("debugMsg");
  if (el) el.textContent = msg;
}
window.addEventListener("error", (e) => debug("JS ERROR: " + e.message));
window.addEventListener("unhandledrejection", (e) => debug("PROMISE ERROR: " + (e.reason?.message || e.reason)));

async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV not found: ${path} (HTTP ${res.status})`);
  return (await res.text()).trim();
}

function parseCSV(csvText) {
  const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
  return { headers, rows };
}

function toNumber(x) {
  const n = Number(String(x).replace("%","").replace(" ", ""));
  return Number.isFinite(n) ? n : null;
}

function renderTable(headers, rows, limit = 20) {
  const container = document.getElementById("tableContainer");
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.slice(0, limit).forEach(r => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = r[h];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}

function buildTimeSpec(data) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: 320,
    data: { values: data },
    layer: [
      {
        mark: { type: "line" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
          tooltip: [
            { field: "date", type: "temporal" },
            { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" }
          ]
        }
      },
      {
        mark: { type: "line", strokeDash: [6,4] },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
          tooltip: [
            { field: "date", type: "temporal" },
            { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" }
          ]
        }
      }
    ],
    resolve: { scale: { y: "independent" } }
  };
}

function buildScatterSpec(data) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: 340,
    data: { values: data },
    transform: [{ calculate: "year(datum.date)", as: "year" }],
    mark: { type: "point", filled: true, opacity: 0.65 },
    encoding: {
      x: { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
      y: { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
      color: { field: "year", type: "quantitative", title: "Year" },
      tooltip: [
        { field: "date", type: "temporal" },
        { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
        { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
        { field: "gdp_growth_yoy", type: "quantitative", title: "GDP YoY (%)" }
      ]
    }
  };
}

function buildGDPSpec(data) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: 320,
    data: { values: data },
    layer: [
      {
        mark: { type: "line" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: { field: "gdp_billions", type: "quantitative", title: "GDP (billions)" },
          tooltip: [
            { field: "date", type: "temporal" },
            { field: "gdp_billions", type: "quantitative", title: "GDP (billions)" }
          ]
        }
      },
      {
        mark: { type: "line", strokeDash: [6,4] },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "gdp_growth_yoy", type: "quantitative", title: "GDP growth YoY (%)" },
          tooltip: [
            { field: "date", type: "temporal" },
            { field: "gdp_growth_yoy", type: "quantitative", title: "GDP YoY (%)" }
          ]
        }
      }
    ],
    resolve: { scale: { y: "independent" } }
  };
}

async function main() {
  debug("Loading dataset…");

  const path = "data/us_economic_indicators.csv";
  const csvText = await loadCSV(path);
  const { headers, rows } = parseCSV(csvText);

  // preview table
  renderTable(headers, rows, 20);

  // typed data
  const data = rows.map(r => ({
    date: r.date,
    gdp_billions: toNumber(r.gdp_billions),
    gdp_growth_yoy: toNumber(r.gdp_growth_yoy),
    unemployment_rate: toNumber(r.unemployment_rate),
    inflation_yoy: toNumber(r.inflation_yoy),
  })).filter(d =>
    d.gdp_billions !== null &&
    d.unemployment_rate !== null &&
    d.inflation_yoy !== null
  );

  await vegaEmbed("#chartTime", buildTimeSpec(data), { actions: false });
  await vegaEmbed("#chartScatter", buildScatterSpec(data), { actions: false });
  await vegaEmbed("#chartGDP", buildGDPSpec(data), { actions: false });

  debug(`OK — loaded ${data.length} quarterly rows.`);
}

main().catch(err => {
  console.error(err);
  debug("ERROR: " + err.message);
  const el = document.getElementById("tableContainer");
  if (el) el.textContent = "ERROR: " + err.message;
});
