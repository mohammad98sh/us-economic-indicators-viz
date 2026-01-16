function setText(id, msg){
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function libsStatus(){
  const okVega = typeof vega !== "undefined";
  const okVL = typeof vegaLite !== "undefined";
  const okEmbed = typeof vegaEmbed !== "undefined";
  setText("statusLibs", `vega: ${okVega ? "OK" : "MISSING"} | vegaLite: ${okVL ? "OK" : "MISSING"} | vegaEmbed: ${okEmbed ? "OK" : "MISSING"}`);
  return { okVega, okVL, okEmbed };
}

async function safeEmbed(selector, spec){
  try{
    if (typeof vegaEmbed === "undefined") {
      throw new Error("vegaEmbed is undefined. Vega CDN scripts are not loaded.");
    }
    await vegaEmbed(selector, spec, { actions: false, renderer: "svg" });
  } catch(e){
    console.error(e);
    setText("debugMsg", `Embed error at ${selector}: ${e.message}`);
  }
}

async function loadCSV(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV not found: ${path} (HTTP ${res.status})`);
  return (await res.text()).trim();
}

function parseCSV(csvText){
  const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h,i) => obj[h] = values[i]);
    return obj;
  });
  return { headers, rows };
}

function toNumber(x){
  const n = Number(String(x).replace("%","").replace(" ", ""));
  return Number.isFinite(n) ? n : null;
}

function renderTable(headers, rows, limit=20){
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

  setText("columnsLine", `Columns: ${headers.join(", ")}.`);
}

function chartWidth(){
  const main = document.querySelector("main");
  const w = main ? main.clientWidth : window.innerWidth;
  return Math.max(320, Math.min(900, w - 60));
}

function baseSpec(){
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    autosize: { type: "fit", contains: "padding" },
    width: chartWidth(),
    config: {
      view: { stroke: null },
      axis: {
        grid: true,
        gridOpacity: 0.15,
        labelColor: "#111827",
        titleColor: "#111827"
      }
    }
  };
}

/**
 * Line + crosshair
 * IMPORTANT: paramName must be unique per chart to avoid duplicate signals in vconcat.
 */
function lineSpec(data, yField, yTitle, paramName){
  return {
    ...baseSpec(),
    height: 240,
    data: { values: data },
    params: [{
      name: paramName,
      select: {
        type: "point",
        fields: ["date"],
        nearest: true,
        on: "mousemove",
        clear: "mouseout"
      }
    }],
    layer: [
      {
        mark: { type: "line" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: { field: yField, type: "quantitative", title: yTitle }
        }
      },

      // point shows on hover
      {
        mark: { type: "point", filled: true, size: 55 },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: yField, type: "quantitative" },
          opacity: { condition: { param: paramName, value: 1 }, value: 0 }
        }
      },

      // vertical rule (x)
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "rule" },
        encoding: { x: { field: "date", type: "temporal" } }
      },

      // horizontal rule (y)
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "rule" },
        encoding: { y: { field: yField, type: "quantitative" } }
      },

      // tooltip anchor
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "point", filled: true, size: 90, opacity: 0.001 },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: yField, type: "quantitative" },
          tooltip: [
            { field: "date", type: "temporal", title: "Date" },
            { field: yField, type: "quantitative", title: yTitle }
          ]
        }
      }
    ]
  };
}

function vconcatSpec(title, specs){
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: title, anchor: "start", fontSize: 14 },
    vconcat: specs,
    spacing: 14
  };
}

/**
 * Scatter + crosshair
 */
function scatterSpec(data){
  const paramName = "hover_scatter";
  return {
    ...baseSpec(),
    height: 330,
    data: { values: data },
    transform: [{ calculate: "year(datum.date)", as: "year" }],
    params: [{
      name: paramName,
      select: {
        type: "point",
        nearest: true,
        on: "mousemove",
        clear: "mouseout"
      }
    }],
    layer: [
      {
        mark: { type: "point", filled: true, opacity: 0.6 },
        encoding: {
          x: { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
          y: { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
          color: { field: "year", type: "quantitative", title: "Year" }
        }
      },

      // highlight
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "point", filled: true, size: 170 },
        encoding: {
          x: { field: "unemployment_rate", type: "quantitative" },
          y: { field: "inflation_yoy", type: "quantitative" }
        }
      },

      // vertical rule
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "rule" },
        encoding: { x: { field: "unemployment_rate", type: "quantitative" } }
      },

      // horizontal rule
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "rule" },
        encoding: { y: { field: "inflation_yoy", type: "quantitative" } }
      },

      // tooltip
      {
        transform: [{ filter: { param: paramName } }],
        mark: { type: "point", filled: true, size: 120, opacity: 0.001 },
        encoding: {
          x: { field: "unemployment_rate", type: "quantitative" },
          y: { field: "inflation_yoy", type: "quantitative" },
          tooltip: [
            { field: "date", type: "temporal", title: "Date" },
            { field: "unemployment_rate", type: "quantitative", title: "Unemployment (%)" },
            { field: "inflation_yoy", type: "quantitative", title: "Inflation YoY (%)" },
            { field: "gdp_growth_yoy", type: "quantitative", title: "GDP YoY (%)" }
          ]
        }
      }
    ]
  };
}

async function renderAllCharts(data){
  // Clear debug per render
  setText("debugMsg", "");

  const timeSpec = vconcatSpec("Time trends", [
    lineSpec(data, "unemployment_rate", "Unemployment (%)", "hover_unemp"),
    lineSpec(data, "inflation_yoy", "Inflation YoY (%)", "hover_infl"),
  ]);

  const gdpSpec = vconcatSpec("GDP trend", [
    lineSpec(data, "gdp_billions", "GDP (billions)", "hover_gdp_level"),
    lineSpec(data, "gdp_growth_yoy", "GDP growth YoY (%)", "hover_gdp_yoy"),
  ]);

  await safeEmbed("#chartTime", timeSpec);
  await safeEmbed("#chartScatter", scatterSpec(data));
  await safeEmbed("#chartGDP", gdpSpec);
}

async function main(){
  setText("statusLine", "JS started ✅");
  setText("debugMsg", "");

  const { okEmbed } = libsStatus();
  if (!okEmbed) {
    setText("statusLine", "Failed ❌");
    setText("debugMsg", "Vega libraries are missing. CDN may be blocked.");
    return;
  }

  setText("statusLine", "Loading CSV…");

  const csvPath = "data/us_economic_indicators.csv";
  const csvText = await loadCSV(csvPath);
  const { headers, rows } = parseCSV(csvText);

  renderTable(headers, rows, 20);

  const data = rows.map(r => ({
    date: r.date,
    gdp_billions: toNumber(r.gdp_billions),
    gdp_growth_yoy: toNumber(r.gdp_growth_yoy),
    unemployment_rate: toNumber(r.unemployment_rate),
    inflation_yoy: toNumber(r.inflation_yoy),
  })).filter(d =>
    d.date &&
    d.gdp_billions !== null &&
    d.gdp_growth_yoy !== null &&
    d.unemployment_rate !== null &&
    d.inflation_yoy !== null
  );

  await renderAllCharts(data);

  // re-render on resize (responsive)
  let t = null;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => renderAllCharts(data), 220);
  });

  setText("statusLine", `Done ✅ (${data.length} rows)`);
}

main().catch(err => {
  console.error(err);
  setText("statusLine", "Failed ❌");
  setText("debugMsg", err.message);
});
