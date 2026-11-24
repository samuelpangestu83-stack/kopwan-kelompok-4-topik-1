
# Interface Contract

## 1. Gambaran Umum

Dokumen ini menjelaskan kesepakatan teknis antara Analysis Layer dan Infrastructure & Operations Layer dalam pengembangan pipeline data prakiraan cuaca Jakarta berbasis Cloudflare.

Kesepakatan ini dibuat agar proses pengambilan, pengolahan, penyimpanan, dan penyajian data dapat berjalan sesuai dengan kebutuhan kedua layer.

## 2. Sumber dan Format Data

Sistem menggunakan data prakiraan cuaca dari Open-Meteo API.

Informasi data:
- Sumber: Open-Meteo API
- Lokasi: Jakarta
- Format: JSON
- Periode: Prakiraan 3 hari
- Resolusi data: Per jam
- Zona waktu: Asia/Jakarta

Tiga indikator yang digunakan:
1. Temperature (temperature_2m), satuan °C.
2. Relative Humidity (relative_humidity_2m), satuan %.
3. Precipitation (precipitation), satuan mm.

Data tersebut dipilih karena dapat digunakan untuk melihat pola prakiraan suhu, kelembapan, dan curah hujan dalam periode pengamatan.

## 3. Kebutuhan Analysis Layer

Analysis Layer bertanggung jawab untuk:
- Menentukan indikator yang digunakan.
- Memeriksa kelengkapan dan validitas data.
- Melakukan analisis statistik deskriptif.
- Menginterpretasikan tren ketiga indikator.
- Menjelaskan keterbatasan hasil analisis.

Hasil analisis yang dibutuhkan meliputi:
- Rata-rata suhu per hari.
- Rata-rata kelembapan per hari.
- Total curah hujan prakiraan per hari.
- Grafik perubahan setiap indikator.

## 4. Kebutuhan Infrastructure & Operations Layer

Infrastructure & Operations Layer bertanggung jawab untuk:
- Menyiapkan layanan Cloudflare.
- Mengembangkan Cloudflare Worker.
- Mengatur jadwal otomatis dengan Cron Trigger.
- Menyimpan data mentah ke Cloudflare R2.
- Menyimpan hasil pengolahan ke Cloudflare D1.
- Menyediakan API untuk dashboard.
- Melakukan monitoring dan penanganan kegagalan.

## 5. Format Penyimpanan Data

Data mentah disimpan dalam format JSON pada Cloudflare R2.

Bucket:
proyekcloudcomputing

Pola penyimpanan:
raw/{run_id}.json

Hasil pengolahan disimpan pada Cloudflare D1.

Database:
topik1-cuaca-db

Tabel daily_forecast:
- run_id
- forecast_date
- avg_temperature
- avg_humidity
- total_precipitation
- hourly_samples

Tabel pipeline_runs:
- run_id
- started_at
- finished_at
- status
- row_count
- error_message

## 6. API dan Output Sistem

Cloudflare Worker menyediakan beberapa endpoint.

GET /health
Digunakan untuk memeriksa status aplikasi.

GET /api/results
Mengembalikan hasil pengolahan terbaru dari database D1 dalam format JSON.

GET /api/status
Mengembalikan riwayat eksekusi pipeline.

POST /admin/run
Menjalankan pipeline secara manual menggunakan ADMIN_TOKEN melalui header x-admin-token.

Hasil pengolahan ditampilkan melalui dashboard web dalam bentuk ringkasan statistik, tabel, dan grafik.

## 7. Jadwal dan Pengolahan Data

Pipeline dijadwalkan berjalan satu kali sehari pada pukul 07.00 WIB menggunakan Cloudflare Cron Trigger.

Cron expression:
0 0 * * *

Setiap eksekusi menjalankan proses:
1. Mengambil data Open-Meteo API.
2. Menyimpan data mentah ke R2.
3. Memeriksa nilai kosong atau tidak valid.
4. Mengelompokkan data berdasarkan tanggal.
5. Menghitung statistik harian.
6. Menyimpan hasilnya ke D1.
7. Mencatat status eksekusi.

Data per jam yang tidak valid dilewati. Apabila seluruh data tidak valid, eksekusi dinyatakan gagal.

## 8. Penanganan Kegagalan

Jika API sumber tidak dapat diakses atau data tidak valid, Worker mencatat kegagalan dalam tabel pipeline_runs selama koneksi database masih tersedia.

Status eksekusi:
- running: proses sedang berjalan.
- success: proses berhasil.
- failed: proses mengalami kegagalan.

Dashboard menggunakan data dari eksekusi terakhir yang berhasil sehingga hasil sebelumnya tetap dapat ditampilkan ketika pengambilan data baru gagal.

## 9. Kesepakatan dan Revisi

Versi dokumen: 1.0
Tanggal penyusunan: 23 November 2026
Status: Draft untuk ditinjau bersama kelompok.

Dokumen ini perlu diperiksa dan disetujui oleh Analysis Layer serta Infrastructure & Operations Layer.

Setiap perubahan sumber data, indikator, format penyimpanan, endpoint, atau jadwal pemrosesan harus didiskusikan terlebih dahulu dan dicatat dalam riwayat revisi.

Riwayat revisi:
- V1.0 (23 November 2026): Penyusunan kontrak berdasarkan implementasi awal Cloudflare.

