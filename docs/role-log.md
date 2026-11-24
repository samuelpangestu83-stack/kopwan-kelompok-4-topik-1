# Role Log Pengerjaan Proyek — Kelompok 4 (Topik 1)

Project ini dikerjakan selama **1 minggu** setelah tim memutuskan berpindah ke **Topik 1 (Pipeline data terbuka serverless dan dashboard)**. Seluruh tahapan—mulai dari perancangan kontrak antarmuka, implementasi kode analisis dan infrastruktur cloud, integrasi dashboard, hingga pengujian dan penyusunan laporan—diselesaikan dengan pembagian peran utama pada dua layer serta kontribusi lintas layer.

## Ringkasan Peran Anggota

| Nama Anggota | Akun GitHub | Peran Utama | Kontribusi Lintas Layer |
| :--- | :--- | :--- | :--- | 
| **Samuel Pangestu** | `samuelpangestu83-stack` | **Analysis Layer** (Akuisisi & validasi dataset Open-Meteo Jakarta, skrip `analysis.py`, statistik deskriptif & analisis tren, penyusunan `analysis-report.md`) | Penyediaan struktur data tren historis untuk integrasi dashboard (`src/app/worker.js`) serta penyelarasan dokumentasi teknis (`README.md`, `interface-contract.md`) |
| **Muhammad Adrian** | `adrian-project` | **Infrastructure & Operations Layer** (Arsitektur Cloudflare Workers & D1, IaC `wrangler.toml`/`schema.sql`/`teardown.sh`, deployment, pengembangan service & dashboard `worker.js`, monitoring, runbook, cost report) | Pengujian otomatis aplikasi (`src/app/tests/worker.test.mjs`) serta verifikasi reproduktibilitas keluaran `analysis.py` untuk konsumsi dashboard | 

---

## Log Aktivitas Terpadu 

### 1. Samuel Pangestu (`samuelpangestu83-stack`) — Analysis Layer & Integrasi Data
* **Perumusan Data & Kontrak Antarmuka:** Memilih sumber data terbuka (*Open-Meteo Historical Weather API* wilayah Jakarta), memverifikasi ketersediaan serta lisensi (CC BY 4.0), menentukan indikator cuaca yang dianalisis, dan menyepakati skema input/output serta penanganan data kosong pada `docs/interface-contract.md`.
* **Pengembangan Pipeline Analisis Reproducible:** Membangun skrip `src/analysis/analysis.py` dan `src/analysis/requirements.txt` untuk pembersihan data hilang (*missing values*), perhitungan statistik deskriptif, agregasi harian/bulanan, serta pemodelan tren historis.
* **Produksi & Validasi Artefak:** Menghasilkan dan memvalidasi seluruh keluaran analisis (`summary.json`, `daily.csv`, `monthly.csv`, `trend.csv`, `validation.json`, serta grafik PNG) dan mendokumentasikan log eksekusinya pada `docs/evidence/analysis-run.txt`.
* **Kontribusi Lintas Layer & Pelaporan:** Menyediakan format payload ringkasan tren historis agar dapat dikonsumsi endpoint dashboard `src/app/worker.js`, menyusun interpretasi beserta batas kesimpulan pada `docs/analysis-report.md`, melakukan review silang pada `docs/cross-review.md`, serta menyelaraskan `README.md` dan `docs/ai-disclosure.md`.
* **Bukti Artefak & Commit:** `src/analysis/*`, `docs/analysis-report.md`, `docs/interface-contract.md`, `docs/evidence/analysis-run.txt`, `README.md` — Commit: `[isi hash commit]`

### 2. Muhammad Adrian (`adrian-project`) — Infrastructure, Operations & Dashboard
* **Setup Repositori & Arsitektur Cloud:** Menyiapkan struktur direktori repositori (`docs/`, `src/app/`, `src/infra/`, `src/config/`), aturan pengecualian kredensial pada `.gitignore`, serta menyusun rancangan arsitektur serverless (`docs/architecture.md`) berbasis Cloudflare Workers (FaaS) dan Cloudflare D1.
* **Infrastruktur sebagai Kode (IaC) & Konfigurasi:** Mengonfigurasi `src/infra/wrangler.toml`, skema database `src/infra/schema.sql`, skrip pembersihan resource `src/infra/teardown.sh`, dan templat variabel lingkungan `src/config/.env.example`.
* **Pengembangan Service & Dashboard Tren Historis:** Membangun endpoint API serta antarmuka dashboard pada `src/app/worker.js`, mengintegrasikan visualisasi tren berbasis data historis teragregasi, dan melakukan deployment ke Cloudflare Workers.
* **Kontribusi Lintas Layer & Operasional:** Menyusun dan menjalankan pengujian otomatis endpoint (`src/app/tests/worker.test.mjs`, `docs/evidence/test-output.txt`), mencatat prosedur operasional dan penghapusan resource (`docs/runbook.md`), menyusun estimasi dan realisasi biaya (`docs/cost-report.md`), analisis keamanan & skalabilitas (`docs/security-scalability.md`), review silang (`docs/cross-review.md`), serta bukti monitoring (`docs/evidence/worker-overview.png`).
* **Bukti Artefak & Commit:** `src/app/worker.js`, `src/app/tests/worker.test.mjs`, `src/infra/*`, `src/config/.env.example`, `docs/architecture.md`, `docs/runbook.md`, `docs/cost-report.md`, `docs/security-scalability.md`, `docs/evidence/*` — Commit: `[isi hash commit]`
