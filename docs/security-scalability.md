# Analisis Keamanan dan Skalabilitas

Dasar analisis: pembacaan kode `src/app/worker.js` (versi branch `main`), konfigurasi di `docs/runbook.md`, 18 tes otomatis (`docs/evidence/test-output.txt`, dijalankan ulang terhadap `worker.js` terbaru), dan pemeriksaan lokal rute historis memakai mock R2. **Tidak dilakukan** uji penetrasi maupun load test; setiap klaim di bawah berstatus hasil tinjauan kode, pemeriksaan lokal, atau perhitungan dari kuota resmi, dan ditandai bila tidak diukur.

## 1. Risiko keamanan terbesar

**Risiko terbesar: endpoint `POST /admin/run` dilindungi satu secret bersama (`ADMIN_TOKEN`) tanpa pembatasan percobaan.**

Mengapa ini yang terbesar:

- Operasi tulis yang dapat dipicu dari internet hanya ada di endpoint ini. Endpoint baca (`/api/results`, `/api/status`, `/api/history`, `/api/history/csv`) hanya mengembalikan data cuaca publik.
- Kode membandingkan token dengan `!==` (tes 7a–7c membuktikan penolakan tanpa token atau dengan token salah), tetapi tidak ada pembatasan laju maupun penguncian. Penyerang dapat menebak token berulang kali, dan setiap permintaan tetap menghabiskan kuota Worker.
- Token yang bocor (misalnya terlihat di screenshot atau riwayat PowerShell saat mengikuti `docs/runbook.md` bagian 5) memberi kemampuan memicu pipeline sesuka hati: menulis baris D1 dan objek R2 baru, serta memanggil Open-Meteo berulang kali.
- Dampak pada data sensitif: **tidak ada**, karena sistem tidak menyimpan data pribadi. Dampak nyata terbatas pada kuota/biaya dan kebersihan data.

Mitigasi yang sudah ada: token disimpan sebagai Worker Secret (bukan di repo); `.gitignore` mengecualikan `.env` dan sejenisnya; respons error tidak membocorkan detail (`Unauthorized`, `Gagal membaca ...`); semua kueri SQL memakai prepared statement (`bind`); jika `ADMIN_TOKEN` belum disetel, endpoint menolak dengan 503 (tes 7d).

Mitigasi yang disarankan (belum diterapkan, urut prioritas):

1. Pasang aturan rate limiting Cloudflare pada path `/admin/run` atau lindungi dengan Cloudflare Access.
2. Putar (rotate) `ADMIN_TOKEN` setelah presentasi dan pastikan tidak tampil di video demo.
3. Bandingkan token dengan fungsi waktu-konstan dan tambahkan kunci eksekusi sederhana agar dua `run` tidak berjalan bersamaan.

## 2. Temuan keamanan lain

| # | Temuan | Tingkat | Status |
|---|---|---|---|
| 1 | Dashboard tidak memuat skrip pihak ketiga. Grafik dirender server-side sebagai SVG (tidak ada tag `<script>` maupun CDN di `worker.js`). | Baik | Sesuai. Temuan Chart.js CDN pada versi sebelumnya sudah tidak berlaku. |
| 2 | Tidak ada header `Content-Security-Policy` (hanya `X-Content-Type-Options: nosniff` dan `Cache-Control: no-store`). | Rendah | Belum diperbaiki. |
| 3 | Endpoint `/api/results`, `/api/status`, `/api/history`, `/api/history/csv`, `/health` publik tanpa autentikasi. | Rendah | Dapat diterima: data publik non-sensitif; `error_message` sengaja tidak diekspos di `/api/status`. |
| 4 | Snapshot `historical-dashboard.json` diunggah manual ke R2. Siapa pun yang punya akses tulis ke bucket dapat mengubah isi dashboard historis. | Sedang | Mitigasi parsial: `loadHistory()` memeriksa bentuk data dan semua teks dari snapshot melewati `escapeHTML` sebelum dirender. Pembatasan akses bucket belum diperiksa (lihat #6). |
| 5 | Least privilege di sisi akun Cloudflare (siapa memiliki akses akun, cakupan API token) | Tidak diketahui | **Tidak diperiksa.** Adrian perlu mencatat siapa saja yang punya akses dan memakai API token dengan cakupan minimum. |
| 6 | Apakah bucket R2 `proyekcloudcomputing` memiliki akses publik | Tidak diketahui | **Tidak diperiksa.** Pastikan akses publik/`r2.dev` dinonaktifkan. |
| 7 | Binding Worker hanya `DB` dan `RAW` | Baik | Sesuai least privilege pada level Worker; terlihat di `docs/evidence/worker-overview.png` (Bindings 2, Workers Logs aktif, Traces nonaktif). |
| 8 | Atribusi lisensi CC BY 4.0 Open-Meteo berupa tautan di footer dashboard | Kepatuhan | Ada di `worker.js` (branch `main`). Status redeploy ke Cloudflare tidak diperiksa. |
| 9 | Belum ada tes otomatis untuk rute `/history`, `/api/history`, dan `/api/history/csv`. Rute ini hanya diperiksa sekali secara lokal dengan mock R2 (status 200, 365 baris CSV). | Rendah | Pemeriksaan lokal tidak disimpan di repository. |

## 3. Perubahan sistem bila beban naik (higher load)

Perhitungan memakai asumsi `docs/cost-report.md` (3 request Worker per kunjungan dashboard) dan kuota gratis yang dikutipnya. **Angka ini hasil hitung, bukan hasil load test; kinerja nyata di bawah beban tidak diukur.**

| Aspek | Kondisi sekarang | Saat beban naik | Tindakan |
|---|---|---|---|
| Request Worker | Observasi 23 Nov: 64 request/hari (`docs/cost-report.md`) | Kuota gratis 100.000 request/hari ÷ 3 ≈ 33.000 kunjungan/hari sebelum kuota habis | Pantau metrik; naik ke paket berbayar bila mendekati batas |
| Beban baca D1 | Halaman prakiraan menjalankan kueri D1 pada setiap kunjungan; semua respons memakai `Cache-Control: no-store` | Setiap pengunjung selalu mengenai D1, padahal data hanya berubah sekali sehari | **Perubahan paling berdampak:** cache respons `/api/results` dan `/api/status` di edge (beberapa menit) |
| Halaman `/history` | Setiap kunjungan membaca snapshot R2 (±62 kB JSON) dan merender HTML ±302 kB dengan grafik SVG di Worker (ukuran diukur lokal dengan mock; **waktu CPU tidak diukur**) | Biaya CPU dan pembacaan R2 per kunjungan lebih besar daripada halaman prakiraan; data hanya berubah saat snapshot diunggah ulang | Cache respons `/history` dan `/api/history`; ukur CPU time di Workers Metrics sebelum menaikkan beban |
| Indeks | Skema hanya punya `idx_forecast_run`; subkueri memfilter `status` dan mengurutkan `finished_at` pada `pipeline_runs` tanpa indeks | Pemindaian `pipeline_runs` bertambah seiring riwayat (±1 baris per hari, dampak kecil) | Opsional: `idx_runs_status_finished` tersedia sebagai komentar di `src/infra/schema.sql` |
| Pertumbuhan data | 3 baris `daily_forecast` + 1 baris `pipeline_runs` per hari (±1.100 baris/tahun untuk forecast, hitung-hitungan) | Linear dan kecil | Tetapkan retensi objek `raw/` di R2 |
| Frekuensi pipeline | 1 panggilan Open-Meteo per hari | Batas gratis Open-Meteo 10.000 panggilan/hari (dikutip dari syarat layanan, tidak diukur): aman bahkan untuk jadwal tiap 15 menit (96/hari) | Cek ulang syarat bila dipakai untuk keperluan komersial |
| Konkurensi pipeline | Tidak ada kunci; dua `run` serentak menghasilkan dua `run_id` | Dashboard tetap membaca satu `run_id` sukses terbaru, tetapi data duplikat menumpuk | Tambahkan kunci/idempotensi per tanggal bila jadwal diperpendek |
| Banyak lokasi/indikator | 1 lokasi, 3 indikator, 72 baris per-jam per run | Waktu eksekusi dan jumlah subrequest per invokasi bertambah | Periksa batas CPU/subrequest pada Workers Limits dan pecah per lokasi (antrean) bila perlu |
| Ketergantungan eksternal | Open-Meteo down → run `failed`, dashboard memakai hasil sukses terakhir (tes 2) | Sama | Pertimbangkan retry dengan backoff (belum ada) |

Ringkasnya, arsitektur serverless menaikkan kapasitas request secara otomatis, tetapi titik yang pertama menjadi bottleneck adalah D1 (tanpa cache), biaya render `/history`, dan kuota harian paket gratis, bukan komputasi forecast-nya.
