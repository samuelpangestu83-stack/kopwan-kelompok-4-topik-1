-- Skema D1 (topik1-cuaca-db).
-- Ini SAMA dengan SQL yang dijalankan di D1 Console saat setup awal (lihat README bagian 8, "Menyiapkan D1").
-- Cara pakai: buka Cloudflare Dashboard > D1 > topik1-cuaca-db > Console, tempel, lalu Execute.
-- (Alternatif CLI, opsional: npx wrangler d1 execute topik1-cuaca-db --remote --file=src/infra/schema.sql -c src/infra/wrangler.toml)

CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS daily_forecast (
    run_id TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    avg_temperature REAL NOT NULL,
    avg_humidity REAL NOT NULL,
    total_precipitation REAL NOT NULL,
    hourly_samples INTEGER NOT NULL,
    PRIMARY KEY (run_id, forecast_date),
    FOREIGN KEY (run_id)
        REFERENCES pipeline_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_forecast_run
ON daily_forecast(run_id);

-- OPSIONAL (TIDAK ada di database yang berjalan; jalankan hanya bila riwayat run membesar):
-- CREATE INDEX IF NOT EXISTS idx_runs_status_finished
-- ON pipeline_runs(status, finished_at);
