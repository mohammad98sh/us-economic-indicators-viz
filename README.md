# US Economy (1975–2024) — Minimal Data Visualization (Vega-Lite)

Minimal, course-ready web visualization of long-run U.S. macroeconomic indicators using **CSV + Vega-Lite** (static site, GitHub Pages friendly).

This project explores quarterly dynamics (1975Q1 → 2024Q1) across:
- **Inflation (YoY)**
- **Unemployment rate**
- **GDP level (billions)**
- **GDP YoY growth (%)**

> Interpretation note: visual relationships shown here are **descriptive/correlational** and do not imply causality.

---

## Live demo (GitHub Pages)

After enabling GitHub Pages, your site will be available here:

- `https://<username>.github.io/<repo>/`

Example:
- `https://mohammad98sh.github.io/us-economic-indicators-viz/`

---

## What’s inside

### Visuals
1. **Time trends**
   - Unemployment rate over time  
   - Inflation (YoY) over time
2. **Inflation × Unemployment**
   - Quarterly scatter plot (hover shows values)
3. **GDP**
   - GDP level (billions)
   - GDP YoY growth (%)
4. **Dataset preview**
   - First rows of the CSV rendered as an HTML table

### Data
- File: `data/us_economic_indicators.csv`
- Columns:
  - `date`
  - `gdp_billions`
  - `gdp_growth_yoy`
  - `unemployment_rate`
  - `inflation_yoy`

---

## Tech stack

- **Vega (v5)**, **Vega-Lite (v5)**, **Vega-Embed (v6)** via CDN
- Plain **HTML / CSS / JavaScript**
- **No build step**, no framework → works directly on GitHub Pages

---

## Project structure

```txt
.
├── index.html
├── style.css
├── script.js
└── data/
    └── us_economic_indicators.csv
