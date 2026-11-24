
// ============================================================
// TOPIK 1 — DASHBOARD CUACA JAKARTA
// Cloudflare Workers + D1 + R2 + Open-Meteo
// Dashboard tanpa JavaScript browser / Chart.js
// ============================================================

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&hourly=temperature_2m,relative_humidity_2m,precipitation&forecast_days=3&timezone=Asia%2FJakarta";

const HISTORY_KEY = "historical-dashboard.json";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

// ============================================================
// 1. PIPELINE OTOMATIS
// ============================================================

async function runPipeline(env) {
  const runId = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO pipeline_runs (run_id, started_at, status) VALUES (?, ?, ?)"
  ).bind(runId, new Date().toISOString(), "running").run();

  try {
    const response = await fetch(WEATHER_API, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error("API cuaca gagal: HTTP " + response.status);
    }

    const raw = await response.text();
    const data = JSON.parse(raw);
    const h = data.hourly;

    if (
      !h ||
      !Array.isArray(h.time) ||
      !Array.isArray(h.temperature_2m) ||
      !Array.isArray(h.relative_humidity_2m) ||
      !Array.isArray(h.precipitation) ||
      h.time.length === 0 ||
      [h.temperature_2m, h.relative_humidity_2m, h.precipitation]
        .some(arr => arr.length !== h.time.length)
    ) {
      throw new Error("Format data cuaca tidak valid atau kosong");
    }

    await env.RAW.put("raw/" + runId + ".json", raw, {
      httpMetadata: { contentType: "application/json" }
    });

    const grouped = {};
    let skipped = 0;

    for (let i = 0; i < h.time.length; i++) {
      const date = String(h.time[i]).slice(0, 10);
      const temp = h.temperature_2m[i];
      const humid = h.relative_humidity_2m[i];
      const rain = h.precipitation[i];

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        ![temp, humid, rain].every(Number.isFinite) ||
        humid < 0 ||
        humid > 100 ||
        rain < 0
      ) {
        skipped++;
        continue;
      }

      if (!grouped[date]) {
        grouped[date] = {
          temp: 0,
          humid: 0,
          rain: 0,
          count: 0
        };
      }

      grouped[date].temp += temp;
      grouped[date].humid += humid;
      grouped[date].rain += rain;
      grouped[date].count++;
    }

    const dates = Object.keys(grouped).sort();

    if (!dates.length) {
      throw new Error("Tidak ada data valid setelah pembersihan");
    }

    const statements = dates.map(date => {
      const x = grouped[date];

      return env.DB.prepare(`
        INSERT INTO daily_forecast
          (run_id, forecast_date, avg_temperature,
           avg_humidity, total_precipitation, hourly_samples)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        runId,
        date,
        x.temp / x.count,
        x.humid / x.count,
        x.rain,
        x.count
      );
    });

    await env.DB.batch(statements);

    await env.DB.prepare(`
      UPDATE pipeline_runs
      SET status = 'success',
          finished_at = ?,
          row_count = ?
      WHERE run_id = ?
    `).bind(
      new Date().toISOString(),
      dates.length,
      runId
    ).run();

    console.log("pipeline_success", runId);

    return {
      ok: true,
      run_id: runId,
      days: dates.length,
      skipped
    };
  } catch (error) {
    console.error("pipeline_failed", String(error));

    try {
      await env.DB.prepare(`
        UPDATE pipeline_runs
        SET status = 'failed',
            finished_at = ?,
            error_message = ?
        WHERE run_id = ?
      `).bind(
        new Date().toISOString(),
        String(error.message).slice(0, 400),
        runId
      ).run();
    } catch (logError) {
      console.error("Gagal mencatat error:", String(logError));
    }

    throw error;
  }
}

// ============================================================
// 2. FORMAT DAN KOMPONEN DASHBOARD
// ============================================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

const numberFormats = new Map();

function fmt(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  if (!numberFormats.has(digits)) {
    numberFormats.set(digits, new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }));
  }

  return numberFormats.get(digits).format(n);
}

function integer(value) {
  return fmt(value, 0);
}

function shortDate(value) {
  const s = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(2, 4)
    : s;
}

function jakartaTime(value) {
  if (!value) return "Belum diketahui";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta"
      }) + " WIB";
}

function pageResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function card(label, value, note, accent = "teal") {
  return `
    <div class="metric ${accent}">
      <div class="metric-label">${escapeHTML(label)}</div>
      <div class="metric-value">${escapeHTML(value)}</div>
      <div class="metric-note">${escapeHTML(note)}</div>
    </div>
  `;
}

function panel(title, subtitle, content, wide = false) {
  return `
    <section class="panel${wide ? " wide" : ""}">
      <div class="panel-head">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(subtitle)}</p>
      </div>
      ${content}
    </section>
  `;
}

function table(columns, data) {
  const head = columns.map(c =>
    `<th>${escapeHTML(c[0])}</th>`
  ).join("");

  const rows = data.map(x =>
    `<tr>${columns.map(c =>
      `<td>${escapeHTML(c[1](x))}</td>`
    ).join("")}</tr>`
  ).join("");

  return `
    <div class="table-scroll">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>
          ${rows || `<tr><td colspan="${columns.length}">Tidak ada data.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// 3. GRAFIK SVG — TANPA CHART.JS
// ============================================================

function svgChart(data, key, unit, color, mode = "line", xkey = "date") {
  const rows = data.filter(r => Number.isFinite(Number(r[key])));

  if (!rows.length) {
    return `<div class="empty">Tidak ada data untuk grafik.</div>`;
  }

  const W = 850;
  const H = 265;
  const left = 55;
  const right = 14;
  const top = 19;
  const bottom = 40;

  const width = W - left - right;
  const height = H - top - bottom;

  const values = rows.map(r => Number(r[key]));

  let ymin = mode === "bar" ? 0 : Math.min(...values);
  let ymax = Math.max(...values);

  if (mode !== "bar") {
    const pad = Math.max(
      (ymax - ymin) * 0.13,
      key.includes("humidity") ? 2 : 0.8
    );

    ymin -= pad;
    ymax += pad;
  }

  if (ymax <= ymin) ymax = ymin + 1;

  const y = v =>
    top + (ymax - v) / (ymax - ymin) * height;

  const x = i =>
    left + (
      (mode === "bar" ? i + 0.5 : i) /
      (mode === "bar" ? rows.length : Math.max(1, rows.length - 1))
    ) * width;

  const grid = Array.from({ length: 5 }, (_, i) => {
    const yy = top + height * i / 4;
    const val = ymax - (ymax - ymin) * i / 4;

    return `
      <line x1="${left}" y1="${yy}"
            x2="${W - right}" y2="${yy}"
            stroke="#e4ebf1"/>
      <text x="${left - 10}" y="${yy + 4}"
            text-anchor="end" fill="#64748b"
            font-size="11">${escapeHTML(fmt(val, 1))}</text>
    `;
  }).join("");

  const markers = [
    0,
    ...Array.from({ length: 5 }, (_, j) =>
      Math.round((rows.length - 1) * (j + 1) / 6)
    ),
    rows.length - 1
  ];

  const labels = [...new Set(markers)].map(i => {
    const raw = String(rows[i][xkey]);

    const label = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw.slice(8, 10) + "/" + raw.slice(5, 7)
      : /^\d{4}-\d{2}$/.test(raw)
        ? raw.slice(5, 7) + "/" + raw.slice(2, 4)
        : raw;

    const anchor = i === 0
      ? "start"
      : i === rows.length - 1
        ? "end"
        : "middle";

    return `
      <text x="${x(i)}" y="${H - 15}"
            text-anchor="${anchor}"
            fill="#64748b" font-size="11">
        ${escapeHTML(label)}
      </text>
    `;
  }).join("");

  let marks;

  if (mode === "bar") {
    const barw = Math.min(
      46,
      Math.max(1.2, width / rows.length * 0.69)
    );

    marks = rows.map((r, i) => {
      const v = Number(r[key]);
      const yy = y(v);
      const xx = x(i) - barw / 2;

      return `
        <rect x="${xx.toFixed(1)}"
              y="${yy.toFixed(1)}"
              width="${barw.toFixed(1)}"
              height="${Math.max(0.5, top + height - yy).toFixed(1)}"
              rx="${rows.length < 50 ? 3 : 0}"
              fill="${color}" opacity="0.85">
          <title>${escapeHTML(r[xkey])}: ${escapeHTML(fmt(v, 2))} ${escapeHTML(unit)}</title>
        </rect>
      `;
    }).join("");
  } else {
    const coords = rows.map((r, i) =>
      `${x(i).toFixed(1)},${y(Number(r[key])).toFixed(1)}`
    );

    const dots = rows.map((r, i) => `
      <circle cx="${x(i).toFixed(1)}"
              cy="${y(Number(r[key])).toFixed(1)}"
              r="${rows.length > 40 ? 2.2 : 4.7}"
              fill="${color}"
              opacity="${rows.length > 40 ? "0.35" : "1"}">
        <title>${escapeHTML(r[xkey])}: ${escapeHTML(fmt(r[key], 2))} ${escapeHTML(unit)}</title>
      </circle>
    `).join("");

    marks = `
      <polyline fill="none"
                stroke="${color}"
                stroke-width="${rows.length > 40 ? 2 : 3}"
                stroke-linejoin="round"
                stroke-linecap="round"
                points="${coords.join(" ")}"/>
      ${dots}
    `;
  }

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}"
           role="img"
           aria-label="Grafik ${escapeHTML(key)}"
           xmlns="http://www.w3.org/2000/svg">
        <title>Grafik ${escapeHTML(key)}</title>
        ${grid}
        <line x1="${left}" y1="${top + height}"
              x2="${W - right}" y2="${top + height}"
              stroke="#a9b9c7"/>
        ${marks}
        ${labels}
      </svg>
    </div>
  `;
}

// ============================================================
// 4. LAYOUT DAN DESAIN DASHBOARD
// ============================================================

function page(active, content) {
  const forecastActive = active === "forecast";

  return `
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#142c42">
<title>Dashboard Cuaca Jakarta | Kelompok 4</title>

<style>
:root {
  --ink: #1d3142;
  --muted: #657a8f;
  --line: #dfe7ee;
  --navy: #142c42;
  --teal: #167f83;
  --bg: #f3f6f8;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.55;
}

.container {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 22px;
}

.hero {
  background: linear-gradient(120deg, #12283d, #1c5265);
  color: white;
  padding: 32px 0 35px;
}

.eyebrow {
  letter-spacing: 2px;
  color: #a2e3e5;
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(28px, 4vw, 39px);
  letter-spacing: -1px;
  margin: 9px 0 8px;
  line-height: 1.15;
}

.hero p {
  max-width: 810px;
  margin: 0;
  color: #d1e4eb;
  font-size: 14px;
}

.hero-line {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.pill {
  border: 1px solid #75aab0;
  color: #cff6f3;
  border-radius: 30px;
  padding: 8px 13px;
  font-size: 12px;
}

main {
  padding-top: 20px;
  padding-bottom: 36px;
}

.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 21px;
  border-bottom: 1px solid var(--line);
}

.tab {
  display: inline-block;
  padding: 13px 18px;
  text-decoration: none;
  font-weight: 750;
  font-size: 14px;
  color: #64758b;
  border-bottom: 3px solid transparent;
}

.tab.active {
  border-bottom-color: var(--teal);
  color: #0b767b;
}

.tab:hover {
  background: #e6f0f1;
  color: #075f65;
}

.topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.topline h2 {
  margin: 0;
  font-size: 23px;
  letter-spacing: -.5px;
}

.topline .desc {
  color: var(--muted);
  font-size: 13px;
  margin: 3px 0 0;
}

.button {
  border: 0;
  border-radius: 8px;
  background: #126f78;
  color: white;
  text-decoration: none;
  padding: 11px 17px;
  font-size: 13px;
  font-weight: 700;
  display: inline-block;
}

.button:hover {
  background: #0d5057;
}

.notice {
  padding: 14px 17px;
  border: 1px solid #cbdfe2;
  background: #ecf7f8;
  border-radius: 9px;
  font-size: 13px;
  margin-bottom: 18px;
  color: #365f64;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric {
  background: white;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 19px 20px;
  box-shadow: 0 3px 12px #18304609;
  border-top: 3px solid #127d88;
}

.metric.blue { border-top-color: #3c83bd; }
.metric.amber { border-top-color: #df9639; }

.metric-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.metric-value {
  font-size: clamp(22px, 2.7vw, 30px);
  font-weight: 800;
  letter-spacing: -.9px;
  margin: 5px 0;
}

.metric-note {
  color: #738497;
  font-size: 12px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.panel {
  background: white;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 19px;
  box-shadow: 0 3px 12px #18304608;
  min-width: 0;
  margin-bottom: 15px;
}

.chart-grid .panel { margin-bottom: 0; }
.wide { grid-column: 1 / -1; }

.panel-head h2 {
  font-size: 16px;
  margin: 0 0 4px;
}

.panel-head p {
  color: var(--muted);
  font-size: 12px;
  margin: 0 0 13px;
}

.chart-wrap {
  width: 100%;
  overflow: hidden;
}

.chart-wrap svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 310px;
}

.table-scroll {
  overflow: auto;
  max-width: 100%;
}

table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

td, th {
  border-bottom: 1px solid #e6edf2;
  padding: 11px 12px;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f7fafb;
  color: #537081;
  font-size: 12px;
}

td { color: #344b60; }

.empty {
  padding: 18px;
  border: 1px solid #e5b978;
  background: #fff9eb;
  border-radius: 10px;
  color: #785822;
  margin-bottom: 18px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stat {
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.stat b {
  font-size: 19px;
  display: block;
  color: #176a76;
  margin: 4px 0;
}

details summary {
  cursor: pointer;
  padding: 10px 0;
  font-weight: 700;
  color: #0e7379;
}

details[open] summary {
  margin-bottom: 12px;
}

footer {
  text-align: center;
  color: #758698;
  font-size: 12px;
  padding: 10px 20px 36px;
}

footer a { color: #086c78; }

@media(max-width:900px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media(max-width:630px) {
  .container { padding: 0 14px; }
  .hero { padding: 25px 0; }

  .metric-grid,
  .chart-grid,
  .stat-grid {
    grid-template-columns: 1fr;
  }

  .wide { grid-column: auto; }
  .tab { padding: 10px; font-size: 12px; }
  .panel { padding: 15px; }
  .topline h2 { font-size: 20px; }
}
</style>
</head>

<body>
<header class="hero">
  <div class="container hero-line">
    <div>
      <div class="eyebrow">
        Kelompok 4 · Komputasi Awan · Topik 1
      </div>
      <h1>Cuaca Jakarta</h1>
      <p>
        Analisis cuaca berbasis serverless dengan Open-Meteo,
        Cloudflare Workers (FaaS), R2 Object Storage,
        dan D1 Database.
      </p>
    </div>
    <span class="pill">● Serverless · Jakarta</span>
  </div>
</header>

<main class="container">
  <nav class="tabs" aria-label="Navigasi dashboard">
    <a class="tab ${forecastActive ? "active" : ""}"
       href="/"
       ${forecastActive ? 'aria-current="page"' : ""}>
      Prakiraan 3 Hari · Otomatis
    </a>

    <a class="tab ${!forecastActive ? "active" : ""}"
       href="/history"
       ${!forecastActive ? 'aria-current="page"' : ""}>
      Analisis Historis 1 Tahun
    </a>
  </nav>

  ${content}
</main>

<footer>
  Weather data by
  <a href="https://open-meteo.com/" rel="noopener noreferrer">
    Open-Meteo.com
  </a>
  · CC BY 4.0 · Cloudflare Workers + D1 + R2

  <p>
    Prakiraan diperbarui melalui Cron;
    analisis historis merupakan hasil pengolahan
    Analysis Layer yang diunggah ke R2.
  </p>
</footer>
</body>
</html>`;
}

// ============================================================
// 5. MEMBACA DATA D1 DAN R2
// ============================================================

async function loadForecast(env) {
  const [a, b] = await Promise.all([
    env.DB.prepare(`
      SELECT forecast_date, avg_temperature,
             avg_humidity, total_precipitation,
             hourly_samples
      FROM daily_forecast
      WHERE run_id = (
        SELECT run_id
        FROM pipeline_runs
        WHERE status = 'success'
        ORDER BY finished_at DESC
        LIMIT 1
      )
      ORDER BY forecast_date
    `).all(),

    env.DB.prepare(`
      SELECT started_at, finished_at,
             status, row_count
      FROM pipeline_runs
      ORDER BY started_at DESC
      LIMIT 10
    `).all()
  ]);

  return {
    data: a.results || [],
    runs: b.results || []
  };
}

async function loadHistory(env) {
  const object = await env.RAW.get(HISTORY_KEY);

  if (!object) return null;

  const data = JSON.parse(await object.text());

  if (
    !Array.isArray(data.daily) ||
    !Array.isArray(data.monthly) ||
    !data.descriptive ||
    !data.validation ||
    !Array.isArray(data.trend) ||
    !data.season_test ||
    !data.metadata
  ) {
    throw new Error("Format historical-dashboard.json tidak sesuai");
  }

  return data;
}

// ============================================================
// 6. HALAMAN PRAKIRAAN 3 HARI
// ============================================================

function forecastPage(model) {
  const { data, runs } = model;
  const latest = runs.find(r => r.status === "success");

  const intro = `
    <div class="topline">
      <div>
        <h2>Prakiraan Cuaca · 3 Hari</h2>
        <p class="desc">
          Terakhir berhasil:
          ${escapeHTML(jakartaTime(latest?.finished_at))}
        </p>
      </div>
      <a class="button" href="/">↻ Perbarui Tampilan</a>
    </div>

    <div class="notice">
      <strong>Data prakiraan, bukan data historis.</strong>
      Angka berasal dari hasil pipeline otomatis terakhir di D1.
      Tombol perbarui hanya memuat halaman,
      tidak menjalankan pipeline.
    </div>
  `;

  if (!data.length) {
    return page("forecast", intro + `
      <div class="empty">
        Data prakiraan belum ada.
        Jalankan pipeline melalui Cron atau POST /admin/run.
      </div>
    `);
  }

  const n = data.reduce(
    (sum, r) => sum + Number(r.hourly_samples || 0), 0
  );

  const meanT = n
    ? data.reduce(
        (sum, r) =>
          sum + Number(r.avg_temperature) * Number(r.hourly_samples),
        0
      ) / n
    : 0;

  const meanH = n
    ? data.reduce(
        (sum, r) =>
          sum + Number(r.avg_humidity) * Number(r.hourly_samples),
        0
      ) / n
    : 0;

  const rain = data.reduce(
    (sum, r) => sum + Number(r.total_precipitation), 0
  );

  const mapped = data.map(r => ({
    ...r,
    date: r.forecast_date
  }));

  const cards = `
    <div class="metric-grid">
      ${card(
        "Rata-rata suhu",
        fmt(meanT) + " °C",
        "Tertimbang sampel/jam",
        "blue"
      )}

      ${card(
        "Rata-rata kelembapan",
        fmt(meanH) + " %",
        "Tertimbang sampel/jam"
      )}

      ${card(
        "Akumulasi hujan",
        fmt(rain) + " mm",
        "Total prakiraan",
        "amber"
      )}

      ${card(
        "Sampel valid",
        integer(n),
        data.length + " tanggal prakiraan"
      )}
    </div>
  `;

  const charts = `
    <div class="chart-grid">
      ${panel(
        "Tren suhu prakiraan",
        "Rata-rata harian (°C)",
        svgChart(mapped, "avg_temperature", "°C", "#287bb5")
      )}

      ${panel(
        "Kelembapan prakiraan",
        "Rata-rata harian (%)",
        svgChart(mapped, "avg_humidity", "%", "#128d86")
      )}

      ${panel(
        "Curah hujan prakiraan",
        "Total per tanggal (mm)",
        svgChart(
          mapped,
          "total_precipitation",
          "mm",
          "#df973e",
          "bar"
        ),
        true
      )}
    </div>
  `;

  const detail = panel(
    "Ringkasan hasil pipeline",
    "Data terbaru di Cloudflare D1 (tabel daily_forecast)",
    table([
      ["Tanggal", x => shortDate(x.forecast_date)],
      ["Suhu (°C)", x => fmt(x.avg_temperature, 2)],
      ["Kelembapan (%)", x => fmt(x.avg_humidity, 2)],
      ["Hujan (mm)", x => fmt(x.total_precipitation, 1)],
      ["Sampel", x => integer(x.hourly_samples)]
    ], data),
    true
  );

  return page("forecast", intro + cards + charts + detail);
}

// ============================================================
// 7. HALAMAN HISTORIS 1 TAHUN
// ============================================================

function historicPage(h) {
  const title = `
    <div class="topline">
      <div>
        <h2>Analisis Historis Jakarta</h2>
        <p class="desc">
          ${escapeHTML(h.metadata.period_start)}
          s.d.
          ${escapeHTML(h.metadata.period_end)}
          · Open-Meteo Historical Weather API
        </p>
      </div>
      <a href="/api/history/csv" class="button">
        ↓ Unduh CSV (365 Hari)
      </a>
    </div>

    <div class="notice">
      <strong>
        Data historis dari model/reanalisis Open-Meteo.
      </strong>
      Analisis periode satu tahun dikerjakan oleh Analysis Layer.
      Snapshot JSON di R2 diperbarui secara manual,
      bukan oleh Cron prakiraan.

      Data ini bukan observasi langsung stasiun BMKG
      atau bukti perubahan iklim jangka panjang.
    </div>
  `;

  const v = h.validation;
  const d = h.descriptive;
  const s = h.season_test;

  const cards = `
    <div class="metric-grid">
      ${card(
        "Sampel valid",
        integer(v.rows_valid),
        "Dari " + integer(v.rows_total) + " data per jam"
      )}

      ${card(
        "Hari dianalisis",
        integer(h.daily.length),
        "Ringkasan harian",
        "blue"
      )}

      ${card(
        "Rata-rata suhu",
        fmt(d.avg_temperature.mean, 2) + " °C",
        "Rerata 365 hari"
      )}

      ${card(
        "Total curah hujan",
        fmt(d.total_precipitation.sum_year, 1) + " mm",
        "Akumulasi periode",
        "amber"
      )}
    </div>
  `;

  const dailyCharts = `
    <div class="chart-grid">
      ${panel(
        "Tren suhu harian",
        "Rata-rata per hari (°C)",
        svgChart(
          h.daily,
          "avg_temperature",
          "°C",
          "#287bb5"
        )
      )}

      ${panel(
        "Tren kelembapan harian",
        "Rata-rata per hari (%)",
        svgChart(
          h.daily,
          "avg_humidity",
          "%",
          "#138e86"
        )
      )}

      ${panel(
        "Curah hujan harian",
        "Akumulasi per hari (mm)",
        svgChart(
          h.daily,
          "total_precipitation",
          "mm",
          "#df973e",
          "bar"
        )
      )}

      ${panel(
        "Curah hujan bulanan",
        "November awal dan akhir hanya sebagian bulan",
        svgChart(
          h.monthly,
          "total_precipitation",
          "mm",
          "#df973e",
          "bar",
          "month"
        )
      )}
    </div>
  `;

  const descriptive = panel(
    "Statistik deskriptif",
    "Dihitung dari ringkasan harian selama periode analisis",
    table([
      ["Indikator", x => x.label],
      ["Rata-rata", x => fmt(x.stats.mean, 2)],
      ["Median", x => fmt(x.stats.median, 2)],
      ["Std. dev.", x => fmt(x.stats.std, 2)],
      ["Min", x => fmt(x.stats.min, 2)],
      ["Maks", x => fmt(x.stats.max, 2)]
    ], [
      {
        label: "Suhu (°C)",
        stats: d.avg_temperature
      },
      {
        label: "Kelembapan (%)",
        stats: d.avg_humidity
      },
      {
        label: "Hujan harian (mm)",
        stats: d.total_precipitation
      }
    ])
  );

  const trends = `
    <div class="stat-grid">
      ${h.trend.map(t => {
        const label = {
          avg_temperature: "Suhu",
          avg_humidity: "Kelembapan",
          total_precipitation: "Curah hujan"
        }[t.indicator] || t.indicator;

        return `
          <div class="stat">
            <span class="metric-label">
              ${escapeHTML(label)}
            </span>
            <b>
              ${t.slope_per_30days >= 0 ? "+" : ""}
              ${escapeHTML(fmt(t.slope_per_30days, 2))}
            </b>
            <span class="metric-note">
              Kemiringan per 30 hari · Kendall τ
              ${escapeHTML(fmt(t.kendall_tau, 2))}
            </span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  const tests = panel(
    "Ringkasan tren dan uji musim",
    "Deskriptif satu siklus musiman; tidak menyimpulkan penyebab atau tren iklim",
    trends + table([
      ["Pengujian", x => x.name],
      ["Hasil", x => x.value]
    ], [
      {
        name: "Median hujan musim basah (Des–Mar)",
        value: fmt(s.wet_median_mm, 2) +
          " mm (" + integer(s.n_wet) + " hari)"
      },
      {
        name: "Median hujan musim kering (Jun–Sep)",
        value: fmt(s.dry_median_mm, 2) +
          " mm (" + integer(s.n_dry) + " hari)"
      },
      {
        name: "Mann–Whitney U",
        value: integer(s.mannwhitney_U)
      },
      {
        name: "p-value",
        value: Number(s.p_value).toExponential(3)
      }
    ])
  );

  const quality = panel(
    "Kualitas dan validasi data",
    "Hasil pemeriksaan Analysis Layer",
    table([
      ["Pemeriksaan", x => x.name],
      ["Hasil", x => x.value]
    ], [
      {
        name: "Total baris input",
        value: integer(v.rows_total)
      },
      {
        name: "Data valid",
        value: integer(v.rows_valid)
      },
      {
        name: "Data tidak valid",
        value: integer(v.rows_invalid)
      },
      {
        name: "Timestamp duplikat",
        value: integer(v.duplicate_timestamps)
      },
      {
        name: "Jam hilang dalam periode",
        value: integer(v.missing_hours_in_range)
      },
      {
        name: "Nilai kosong suhu",
        value: integer(v.missing.temperature_2m)
      },
      {
        name: "Nilai kosong kelembapan",
        value: integer(v.missing.relative_humidity_2m)
      },
      {
        name: "Nilai kosong curah hujan",
        value: integer(v.missing.precipitation)
      }
    ])
  );

  const monthly = panel(
    "Ringkasan bulanan",
    "November 2025 dan November 2026 parsial, sehingga total hujannya tidak setara bulan penuh",
    table([
      ["Bulan", r => r.month],
      ["Suhu (°C)", r => fmt(r.avg_temperature, 2)],
      ["Kelembapan (%)", r => fmt(r.avg_humidity, 2)],
      ["Hujan (mm)", r => fmt(r.total_precipitation, 1)],
      ["Hari hujan ≥1 mm", r => integer(r.rainy_days_ge_1mm)]
    ], h.monthly)
  );

  const dailyTable = `
    <details>
      <summary>
        Lihat seluruh ${integer(h.daily.length)} baris data harian
      </summary>
      ${table([
        ["Tanggal", r => r.date],
        ["Suhu rata-rata", r => fmt(r.avg_temperature, 2)],
        ["Suhu min", r => fmt(r.min_temperature, 1)],
        ["Suhu maks", r => fmt(r.max_temperature, 1)],
        ["Kelembapan (%)", r => fmt(r.avg_humidity, 2)],
        ["Hujan (mm)", r => fmt(r.total_precipitation, 1)],
        ["Jam", r => integer(r.hourly_samples)]
      ], h.daily)}
    </details>
  `;

  return page(
    "history",
    title +
    cards +
    dailyCharts +
    descriptive +
    tests +
    quality +
    monthly +
    panel(
      "Dataset harian lengkap",
      "Bisa juga diunduh sebagai CSV",
      dailyTable
    )
  );
}

// ============================================================
// 8. ROUTING API DAN DASHBOARD
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (
      request.method === "GET" &&
      path === "/health"
    ) {
      return json({ status: "ok" });
    }

    // API prakiraan terbaru
    if (
      request.method === "GET" &&
      path === "/api/results"
    ) {
      try {
        const model = await loadForecast(env);
        return json(model.data);
      } catch (error) {
        console.error("results_failed", String(error));
        return json({ error: "Gagal membaca data D1" }, 500);
      }
    }

    // API riwayat pipeline
    if (
      request.method === "GET" &&
      path === "/api/status"
    ) {
      try {
        const result = await env.DB.prepare(`
          SELECT started_at, finished_at, status, row_count
          FROM pipeline_runs
          ORDER BY started_at DESC
          LIMIT 10
        `).all();

        return json(result.results || []);
      } catch (error) {
        console.error("status_failed", String(error));
        return json({ error: "Gagal membaca riwayat" }, 500);
      }
    }

    // API historis dan download CSV
    if (
      request.method === "GET" &&
      (
        path === "/api/history" ||
        path === "/api/history/csv"
      )
    ) {
      try {
        const h = await loadHistory(env);

        if (!h) {
          return json({
            error: HISTORY_KEY + " belum tersedia di R2"
          }, 404);
        }

        if (path === "/api/history") {
          return json(h);
        }

        const columns = [
          "date",
          "avg_temperature",
          "min_temperature",
          "max_temperature",
          "avg_humidity",
          "total_precipitation",
          "hourly_samples"
        ];

        const lines = [
          columns.join(","),
          ...h.daily.map(r =>
            columns.map(k => String(r[k] ?? "")).join(",")
          )
        ];

        return new Response(lines.join("\n") + "\n", {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              "attachment; filename=jakarta-historical-daily.csv",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          }
        });
      } catch (error) {
        console.error("history_failed", String(error));

        return json({
          error: "Gagal membaca snapshot historis R2"
        }, 500);
      }
    }

    // Endpoint admin untuk eksekusi manual
    if (
      request.method === "POST" &&
      path === "/admin/run"
    ) {
      if (!env.ADMIN_TOKEN) {
        return json({
          error: "ADMIN_TOKEN belum disetel"
        }, 503);
      }

      if (
        request.headers.get("x-admin-token") !==
        env.ADMIN_TOKEN
      ) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        return json(await runPipeline(env));
      } catch (error) {
        console.error("manual_run_failed", String(error));

        return json({
          error: "Pipeline gagal, periksa log"
        }, 502);
      }
    }

    // Dashboard prakiraan
    if (
      request.method === "GET" &&
      path === "/"
    ) {
      try {
        return pageResponse(
          forecastPage(await loadForecast(env))
        );
      } catch (error) {
        console.error("dashboard_error", String(error));

        return pageResponse(
          page("forecast", `
            <div class="empty">
              Dashboard gagal membaca data.
              Periksa binding DB dan Observability Cloudflare.
            </div>
          `),
          500
        );
      }
    }

    // Dashboard historis
    if (
      request.method === "GET" &&
      path === "/history"
    ) {
      try {
        const h = await loadHistory(env);

        if (!h) {
          return pageResponse(
            page("history", `
              <div class="empty">
                File ${escapeHTML(HISTORY_KEY)} belum ditemukan.
                Upload ke root bucket R2 proyekcloudcomputing.
              </div>
            `),
            404
          );
        }

        return pageResponse(historicPage(h));
      } catch (error) {
        console.error("dashboard_error", String(error));

        return pageResponse(
          page("history", `
            <div class="empty">
              Dashboard historis gagal membaca data.
              Periksa binding RAW dan Observability Cloudflare.
            </div>
          `),
          500
        );
      }
    }

    return json({ error: "Not found" }, 404);
  },

  // Cron Trigger harian
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPipeline(env));
  }
};
