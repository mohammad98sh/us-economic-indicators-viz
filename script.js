async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV not found: ${path} (HTTP ${res.status})`);
  return (await res.text()).trim();
}

function parseCSV(csvText) {
  const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    // simple CSV parser (works if no commas inside values)
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });

  return { headers, rows };
}

function fillSelect(selectEl, headers, preferred = []) {
  selectEl.innerHTML = "";
  headers.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    selectEl.appendChild(opt);
  });

  // pick a default if possible
  for (const p of preferred) {
    const found = headers.find(h => h.toLowerCase() === p.toLowerCase());
    if (found) {
      selectEl.value = found;
      return;
    }
  }
  selectEl.selectedIndex = 0;
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

function toNumber(x) {
  const n = Number(String(x).replace("%","").replace(" ", ""));
  return Number.isFinite(n) ? n : null;
}

function buildTimeSpec(data, colDate, colUnemp, colInfl) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: 320,
    data: { values: data },
    transform: [
      { filter: `isValid(datum.${colDate}) && isValid(datum.${colUnemp}) && isValid(datum.${colInfl})` }
    ],
    layer: [
      {
        mark: { type: "line" },
        encoding: {
          x: { field: colDate, type: "temporal", title: "Date" },
          y: { field: colUnemp, type: "quantitative", title: "Unemployment" },
          tooltip: [
            { field: colDate, type: "temporal" },
            { field: colUnemp, type: "quantitative" }
          ]
        }
      },
      {
        mark: { type: "line", strokeDash: [6,4] },
        encoding: {
          x: { field: colDate, type: "temporal" },
          y: { field: colInfl, type: "quantitative", title: "Inflation" },
          tooltip: [
            { field: colDate, type: "temporal" },
            { field: colInfl, type: "quantitative" }
          ]
        }
      }
    ],
    resolve: { scale: { y: "independent" } }
  };
}

function buildScatterSpec(data, colDate, colUnemp, colInfl) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: 340,
    data: { values: data },
    transform: [
      { filter: `isValid(datum.${colDate}) && isValid(datum.${colUnemp}) && isValid(datum.${colInfl})` },
      { calculate: "year(datum." + colDate + ")", as: "year" }
    ],
    mark: { type: "point", filled: true, opacity: 0.65 },
    encoding: {
      x: { field: colUnemp, type: "quantitative", title: "Unemployment" },
      y: { field: colInfl, type: "quantitative", title: "Inflation" },
      color: { field: "year", type: "quantitative", title: "Year" },
      tooltip: [
        { field: colDate, type: "temporal" },
        { field: colUnemp, type: "quantitative" },
        { field: colInfl, type: "quantitative" }
      ]
    }
  };
}

async function main() {
  const path = "data/us_economic_indicators.csv";
  const csvText = await loadCSV(path);
  const { headers, rows } = parseCSV(csvText);

  renderTable(headers, rows, 20);

  const selDate = document.getElementById("colDate");
  const selUnemp = document.getElementById("colUnemp");
  const selInfl = document.getElementById("colInfl");

  fillSelect(selDate, headers, ["date", "DATE", "time", "year"]);
  fillSelect(selUnemp, headers, ["unemployment", "unemployment_rate", "unemp", "unrate"]);
  fillSelect(selInfl, headers, ["inflation", "inflation_rate", "cpi_inflation", "infl"]);

  // Convert to "typed" objects but keep original keys
  const data = rows.map(r => {
    const o = { ...r };
    // try parse date into ISO-ish if it's year only
    // vega-lite can handle many date strings; we keep as is.
    return o;
  });

  async function renderCharts() {
    const colDate = selDate.value;
    const colUnemp = selUnemp.value;
    const colInfl = selInfl.value;

    // Create copies with numeric fields parsed where possible
    const typed = data.map(d => {
      const obj = { ...d };
      obj[colUnemp] = toNumber(d[colUnemp]);
      obj[colInfl] = toNumber(d[colInfl]);
      return obj;
    });

    const timeSpec = buildTimeSpec(typed, colDate, colUnemp, colInfl);
    const scatterSpec = buildScatterSpec(typed, colDate, colUnemp, colInfl);

    await vegaEmbed("#chartTime", timeSpec, { actions: false });
    await vegaEmbed("#chartScatter", scatterSpec, { actions: false });
  }

  selDate.addEventListener("change", renderCharts);
  selUnemp.addEventListener("change", renderCharts);
  selInfl.addEventListener("change", renderCharts);

  await renderCharts();
}

main().catch(err => {
  console.error(err);
  const el = document.getElementById("tableContainer");
  if (el) el.textContent = `ERROR: ${err.message}`;
});
