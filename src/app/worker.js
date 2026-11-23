
// Cloudflare Worker - Pipeline prakiraan cuaca Jakarta
// Bindings: DB (D1), RAW (R2), ADMIN_TOKEN (Secret)

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&hourly=temperature_2m,relative_humidity_2m,precipitation&forecast_days=3&timezone=Asia%2FJakarta";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

// Mengambil dan mengolah data cuaca
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

    // Menyimpan data mentah ke R2
    await env.RAW.put("raw/" + runId + ".json", raw, {
      httpMetadata: {
        contentType: "application/json"
      }
    });

    // Membersihkan dan mengelompokkan data
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

    // Menyimpan hasil ke D1
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

// Dashboard HTML
const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>Dashboard Prakiraan Cuaca Jakarta</title>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f3f6fa;
      color: #1b2b40;
    }

    header {
      background: #17395b;
      color: white;
      padding: 28px 22px;
    }

    .wrap {
      max-width: 1050px;
      margin: 0 auto;
    }

    header h1 {
      margin: 0 0 8px;
      font-size: 26px;
    }

    header p {
      margin: 0;
      color: #d8e5f1;
      line-height: 1.5;
    }

    main {
      padding: 24px 18px 36px;
    }

    .topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 17px;
    }

    .status {
      font-size: 13px;
      color: #546477;
    }

    button {
      border: 0;
      background: #2365a0;
      color: white;
      padding: 11px 15px;
      border-radius: 7px;
      cursor: pointer;
    }

    button:hover {
      background: #174b79;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .card, .panel {
      background: white;
      border: 1px solid #e1e8ef;
      border-radius: 10px;
      padding: 20px;
    }

    .card .label {
      color: #62758a;
      font-size: 13px;
    }

    .card .value {
      font-size: 29px;
      font-weight: bold;
      margin-top: 12px;
    }

    .card .detail {
      color: #62758a;
      font-size: 12px;
      margin-top: 7px;
    }

    .charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .panel {
      margin-bottom: 14px;
    }

    .panel h2 {
      font-size: 17px;
      margin: 0 0 6px;
    }

    .panel p {
      color: #65758a;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 12px;
    }

    .plot {
      position: relative;
      height: 250px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 14px;
    }

    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid #e7edf3;
      text-align: left;
    }

    th {
      background: #f7f9fc;
    }

    .tablewrap {
      overflow-x: auto;
    }

    .notice {
      background: #fff6e7;
      padding: 12px 15px;
      border-radius: 7px;
      color: #775014;
      font-size: 13px;
      margin-bottom: 16px;
    }

    footer {
      text-align: center;
      color: #65758a;
      font-size: 12px;
      padding-bottom: 22px;
      line-height: 1.7;
    }

    @media (max-width: 700px) {
      .cards, .charts {
        grid-template-columns: 1fr;
      }

      .wide {
        grid-column: auto;
      }

      header h1 {
        font-size: 22px;
      }

      .card .value {
        font-size: 25px;
      }
    }
  </style>
</head>

<body>
  <header>
    <div class="wrap">
      <h1>Dashboard Prakiraan Cuaca Jakarta</h1>
      <p>
        Suhu, kelembapan, dan curah hujan berdasarkan
        prakiraan Open-Meteo
      </p>
    </div>
  </header>

  <main class="wrap">
    <div class="topline">
      <div class="status" id="status">
        Memuat data...
      </div>

      <button id="refresh">
        Perbarui tampilan
      </button>
    </div>

    <div class="notice">
      Grafik menunjukkan prakiraan 3 hari, bukan catatan
      cuaca yang sudah terjadi. Tombol perbarui hanya membaca
      ulang data, bukan menjalankan pipeline.
    </div>

    <section class="cards">
      <div class="card">
        <div class="label">Rata-rata suhu prakiraan</div>
        <div class="value" id="temp">-</div>
        <div class="detail">Seluruh hari prakiraan terbaru</div>
      </div>

      <div class="card">
        <div class="label">Rata-rata kelembapan</div>
        <div class="value" id="humid">-</div>
        <div class="detail">Seluruh hari prakiraan terbaru</div>
      </div>

      <div class="card">
        <div class="label">Total curah hujan prakiraan</div>
        <div class="value" id="rain">-</div>
        <div class="detail">Akumulasi seluruh hari prakiraan</div>
      </div>
    </section>

    <section class="charts">
      <div class="panel">
        <h2>Tren suhu</h2>
        <p>Rata-rata suhu per hari (°C)</p>
        <div class="plot">
          <canvas id="chartTemp"></canvas>
        </div>
      </div>

      <div class="panel">
        <h2>Tren kelembapan</h2>
        <p>Rata-rata kelembapan per hari (%)</p>
        <div class="plot">
          <canvas id="chartHumid"></canvas>
        </div>
      </div>

      <div class="panel wide">
        <h2>Prakiraan curah hujan</h2>
        <p>Jumlah curah hujan per hari (mm)</p>
        <div class="plot">
          <canvas id="chartRain"></canvas>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Tabel hasil pengolahan</h2>
      <p>
        Diambil dari tabel daily_forecast
        pada Cloudflare D1.
      </p>
      <div class="tablewrap" id="hasil">
        Memuat tabel...
      </div>
    </section>
  </main>

  <footer>
    Sumber data: Open-Meteo · Lokasi: Jakarta ·
    Pipeline: Cloudflare Workers, R2, dan D1
  </footer>

  <script>
    const charts = [];

    const el = id => document.getElementById(id);

    const fmt = n => Number(n).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    });

    function drawChart(id, type, labels, values, color, unit) {
      if (!window.Chart) return;

      const ctx = el(id);

      charts.push(new Chart(ctx, {
        type,
        data: {
          labels,
          datasets: [{
            label: unit,
            data: values,
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 4,
            borderRadius: type === 'bar' ? 5 : 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: type === 'bar',
              title: {
                display: true,
                text: unit
              }
            }
          }
        }
      }));
    }

    async function loadDashboard() {
      el('status').textContent = 'Mengambil data terbaru...';

      try {
        const [rData, rStatus] = await Promise.all([
          fetch('/api/results', { cache: 'no-store' }),
          fetch('/api/status', { cache: 'no-store' })
        ]);

        if (!rData.ok || !rStatus.ok) {
          throw new Error('Gagal membaca API Worker');
        }

        const data = await rData.json();
        const history = await rStatus.json();

        if (!Array.isArray(data) || data.length === 0) {
          el('hasil').textContent =
            'Belum ada data. Jalankan pipeline terlebih dahulu.';

          el('status').textContent =
            'Belum ada hasil pipeline';

          return;
        }

        // Menghitung ringkasan
        const totalSamples = data.reduce(
          (a, x) => a + Number(x.hourly_samples),
          0
        );

        const meanTemp = data.reduce(
          (a, x) =>
            a + Number(x.avg_temperature) * Number(x.hourly_samples),
          0
        ) / totalSamples;

        const meanHumid = data.reduce(
          (a, x) =>
            a + Number(x.avg_humidity) * Number(x.hourly_samples),
          0
        ) / totalSamples;

        const totalRain = data.reduce(
          (a, x) => a + Number(x.total_precipitation),
          0
        );

        el('temp').textContent = fmt(meanTemp) + ' °C';
        el('humid').textContent = fmt(meanHumid) + ' %';
        el('rain').textContent = fmt(totalRain) + ' mm';

        // Menampilkan waktu pembaruan terakhir
        const latest = Array.isArray(history)
          ? history.find(x => x.status === 'success')
          : null;

        el('status').textContent = latest
          ? 'Pembaruan terakhir: ' +
            new Date(latest.finished_at).toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta'
            }) + ' WIB'
          : 'Data berhasil dibaca';

        // Tabel hasil pengolahan
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        [
          'Tanggal',
          'Suhu rata-rata (°C)',
          'Kelembapan (%)',
          'Curah hujan (mm)',
          'Sampel/jam'
        ].forEach(label => {
          const th = document.createElement('th');
          th.textContent = label;
          headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        data.forEach(x => {
          const tr = document.createElement('tr');

          [
            x.forecast_date,
            fmt(x.avg_temperature),
            fmt(x.avg_humidity),
            fmt(x.total_precipitation),
            x.hourly_samples
          ].forEach(value => {
            const td = document.createElement('td');
            td.textContent = String(value);
            tr.appendChild(td);
          });

          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        el('hasil').replaceChildren(table);

        // Menggambar tiga grafik
        charts.forEach(c => c.destroy());
        charts.length = 0;

        const labels = data.map(x => x.forecast_date);

        drawChart(
          'chartTemp',
          'line',
          labels,
          data.map(x => Number(x.avg_temperature)),
          '#2769a1',
          '°C'
        );

        drawChart(
          'chartHumid',
          'line',
          labels,
          data.map(x => Number(x.avg_humidity)),
          '#168a76',
          '%'
        );

        drawChart(
          'chartRain',
          'bar',
          labels,
          data.map(x => Number(x.total_precipitation)),
          '#df8d31',
          'mm'
        );

        if (!window.Chart) {
          el('status').textContent +=
            ' · Grafik tidak tersedia (Chart.js gagal dimuat)';
        }

      } catch (err) {
        el('hasil').textContent =
          'Gagal memuat data. Periksa /api/results dan /api/status.';

        el('status').textContent =
          'Terjadi kesalahan membaca data';

        console.error(err);
      }
    }

    el('refresh').addEventListener('click', loadDashboard);
    loadDashboard();
  </script>
</body>
</html>`;

// Endpoint API dan halaman dashboard
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }

    // Hasil analisis terbaru
    if (request.method === "GET" && url.pathname === "/api/results") {
      try {
        const result = await env.DB.prepare(`
          SELECT forecast_date,
                 avg_temperature,
                 avg_humidity,
                 total_precipitation,
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
        `).all();

        return json(result.results || []);

      } catch (error) {
        console.error("results_failed", String(error));
        return json({ error: "Tidak bisa membaca data" }, 500);
      }
    }

    // Riwayat pipeline
    if (request.method === "GET" && url.pathname === "/api/status") {
      try {
        const result = await env.DB.prepare(`
          SELECT started_at,
                 finished_at,
                 status,
                 row_count
          FROM pipeline_runs
          ORDER BY started_at DESC
          LIMIT 10
        `).all();

        return json(result.results || []);

      } catch (error) {
        console.error("status_failed", String(error));
        return json({ error: "Tidak bisa membaca status" }, 500);
      }
    }

    // Menjalankan pipeline secara manual
    if (request.method === "POST" && url.pathname === "/admin/run") {
      if (!env.ADMIN_TOKEN) {
        return json({ error: "ADMIN_TOKEN belum diatur" }, 503);
      }

      if (request.headers.get("x-admin-token") !== env.ADMIN_TOKEN) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        return json(await runPipeline(env));
      } catch {
        return json({
          error: "Pipeline gagal, periksa log Worker"
        }, 502);
      }
    }

    // Dashboard
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(DASHBOARD_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return json({ error: "Not found" }, 404);
  },

  // Menjalankan pipeline otomatis melalui Cron
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPipeline(env));
  }
};

