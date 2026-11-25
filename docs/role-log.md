# Role Log Pengerjaan Proyek — Kelompok 4 (Topik 1)

Proyek **Topik 1 (Pipeline data terbuka serverless dan dashboard)** dikerjakan oleh dua anggota aktif dengan pembagian dua layer: **Analysis Layer** dan **Infrastructure & Operations Layer**. Repositori dibuat pada 23 November 2026 dan difinalisasi pada 25 November 2026. Seluruh klaim kontribusi di bawah dapat ditelusuri pada riwayat commit repositori (juga salinannya di `riwayat-commit.txt`) berdasarkan pesan commit dan tanggal yang dicantumkan.

## Ringkasan Peran Anggota

| Nama Anggota | Akun GitHub | Peran Utama | Kontribusi Lintas Layer |
| :--- | :--- | :--- | :--- |
| **Samuel Pangestu** | `samuelpangestu83-stack` | **Analysis Layer**: dataset historis Open-Meteo Jakarta, `analysis.py`, statistik deskriptif dan analisis tren, `build_dashboard_data.py`, `analysis-report.md` | Revisi `interface-contract.md` dan `cross-review.md`, pengunggahan ulang `docs/evidence`, pengelolaan branch dan merge pull request ke `main` |
| **Muhammad Adrian** | `adrian-project` | **Infrastructure & Operations Layer**: arsitektur Cloudflare Workers, D1, dan R2, `worker.js` (pipeline, API, dashboard), IaC (`wrangler.toml`, `schema.sql`, `teardown.sh`), deployment, monitoring, runbook, laporan biaya, analisis keamanan | Kerangka dan isi dokumen teknis (`architecture.md`, `interface-contract.md`, `README.md`), pembuatan `cross-review.md`, integrasi data historis ke dashboard |

## Log Aktivitas

### 1. Samuel Pangestu (`samuelpangestu83-stack`): Analysis Layer

* **Analisis data:** Menyusun kode analisis di `src/analysis/` (`analysis.py`, `build_dashboard_data.py`, `requirements.txt`), mencakup validasi data, agregasi harian dan bulanan, statistik deskriptif, uji tren, dan uji perbandingan musim. Commit: "Create analysis" (23 Nov), "add analysis" (25 Nov).
* **Laporan analisis:** Menulis `docs/analysis-report.md`, berisi hasil, interpretasi, dan batas kesimpulan. Commit: "Add analysis report on Jakarta weather trends" (24 Nov).
* **Kontrak antarmuka:** Merevisi `docs/interface-contract.md` untuk kejelasan alur data. Commit: "Revise interface contract for data pipeline clarity" (24 Nov).
* **Review silang:** Merevisi `docs/cross-review.md` untuk persetujuan akhir dan rincian waktu respons endpoint. Commit: "Revise cross-review document for final approvals", "Update cross-review.md with endpoint response timing details" (23 Nov).
* **Bukti dan dokumentasi proyek:** Memperbarui role log dan riwayat commit, serta mengunggah ulang folder bukti. Commit: "Update role log for Project Group 4", "Add commit history for project updates", "Update commit history in riwayat-commit.txt", "Delete docs/evidence" dan "Add files via upload" (24 Nov).
* **Integrasi ke `main`:** Membuka dan menggabungkan pull request #1, #2, dan #3 dari branch `Group-Final-Project`.
* **Bukti artefak:** `src/analysis/*`, `docs/analysis-report.md`, `docs/evidence/analysis-run.txt`.

### 2. Muhammad Adrian (`adrian-project`): Infrastructure, Operations dan Dashboard

* **Kerangka repositori (23 Nov):** Membuat struktur `src/app`, `src/infra`, `src/config`, `docs/evidence`, serta kerangka seluruh dokumen di `docs/` (arsitektur, kontrak antarmuka, runbook, laporan biaya, keamanan dan skalabilitas, cross-review, role log, AI disclosure).
* **Worker dan dashboard:** Membuat `src/app/worker.js` (pipeline Cron, API, dashboard prakiraan) dan memperbaruinya untuk menyajikan analisis historis dari snapshot R2 (`/history`, `/api/history`, `/api/history/csv`). Commit: "Create worker.js", "Cloudflare Worker for Jakarta weather data processing" (23 Nov), dua commit "Update worker.js" (25 Nov).
* **Infrastruktur dan konfigurasi:** `src/infra/` (`wrangler.toml`, `schema.sql`, `teardown.sh`) dan `src/config/.env.example`. Commit: "Create infra", "Create config" (23 Nov).
* **Dokumentasi operasional:** `docs/architecture.md`, `docs/runbook.md`, `docs/cost-report.md`, dan `docs/interface-contract.md`, dibuat pada 23 Nov dan direvisi pada 25 Nov.
* **README:** Menyusun dan merevisi `README.md`. Commit: "Enhance README with comprehensive project details" (24 Nov), "Revise README for clarity and updated project details" (25 Nov).
* **Review silang:** Membuat `docs/cross-review.md` dan memperbaiki detail reviewer dan tanggal. Commit: "Add cross-review documentation for Analysis and Infra" dan dua commit perbaikannya (25 Nov).
* **Deployment, monitoring, dan biaya:** Men-deploy Worker lewat dashboard Cloudflare dan mengumpulkan bukti penggunaan serta biaya di `docs/evidence/`.
* **Bukti artefak:** `src/app/*`, `src/infra/*`, `src/config/.env.example`, `docs/architecture.md`, `docs/runbook.md`, `docs/cost-report.md`, `docs/security-scalability.md`, `docs/evidence/*`.
