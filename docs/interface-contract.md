# Interface Contract

## 1. Gambaran Umum

Dokumen ini menjelaskan kesepakatan teknis antara **Analysis Layer** dan **Infrastructure & Operations Layer** dalam pengembangan pipeline data cuaca Jakarta berbasis Cloudflare.

Kesepakatan ini dibuat agar proses pengambilan, pengolahan, penyimpanan, dan penyajian data dapat berjalan sesuai dengan kebutuhan kedua layer.

## 2. Sumber dan Format Data

Sistem menggunakan data prakiraan cuaca dan data historis dari Open-Meteo API (lisensi CC BY 4.0).

Informasi data prakiraan:
- Sumber: Open-Meteo Forecast API
- Lokasi: Jakarta (`latitude: -6.2088`, `longitude: 106.8456`)
- Format: JSON
- Periode: Prakiraan 3 hari
- Resolusi data: Per jam
- Zona waktu: Asia/Jakarta

Tiga indikator yang digunakan:
1. Temperature (`temperature_2m`), satuan °C.
2. Relative Humidity (`relative_humidity_2m`), satuan %.
3. Precipitation (`precipitation`), satuan mm.

Data tersebut dipilih karena dapat digunakan untuk melihat pola prakiraan suhu, kelembapan, dan curah hujan dalam periode pengamatan, serta dibandingkan konteksnya dengan analisis historis satu tahun.

## 3. Kebutuhan Analysis Layer

Analysis Layer bertanggung jawab untuk:
- Menentukan indikator yang digunakan.
- Memeriksa kelengkapan dan validitas data.
- Melakukan analisis statistik deskriptif dan tren historis satu tahun (`src/analysis/analysis.py`).
- Menginterpretasikan tren ketiga indikator.
- Menjelaskan keterbatasan hasil analisis.

Hasil analisis yang dibutuhkan meliputi:
- Rata-rata suhu per hari.
- Rata-rata kelembapan per hari.
- Total curah hujan prakiraan per hari.
- Ringkasan statistik deskriptif, bulanan, dan tren historis satu tahun.
- Grafik perubahan setiap indikator pada dashboard.

## 4. Kebutuhan Infrastructure & Operations Layer

Infrastructure & Operations Layer bertanggung jawab untuk:
- Menyiapkan layanan Cloudflare.
- Mengembangkan Cloudflare Worker.
- Mengatur jadwal otomatis dengan Cron Trigger.
- Menyimpan data mentah dan snapshot analisis historis ke Cloudflare R2.
- Menyimpan hasil pengolahan prakiraan ke Cloudflare D1.
- Menyediakan API dan antarmuka dashboard web.
- Melakukan monitoring dan penanganan kegagalan.

## 5. Format Penyimpanan Data

Data mentah dan snapshot hasil analisis disimpan dalam format JSON pada Cloudflare R2.

Bucket:
`proyekcloudcomputing`

Pola penyimpanan:
- Data mentah prakiraan: `raw/{run_id}.json`
- Snapshot analisis historis: `historical-dashboard.json` pada root bucket (dibuat oleh `src/analysis/build_dashboard_data.py` dari keluaran `analysis.py`, diunggah manual)

Hasil pengolahan prakiraan disimpan pada Cloudflare D1.

Database:
`topik1-cuaca-db`

Tabel `daily_forecast`:
- `run_id`
- `forecast_date`
- `avg_temperature`
- `avg_humidity`
- `total_precipitation`
- `hourly_samples`

Tabel `pipeline_runs`:
- `run_id`
- `started_at`
- `finished_at`
- `status`
- `row_count`
- `error_message`

## 6. API dan Output Sistem

Cloudflare Worker menyediakan endpoint dan rute dashboard berikut:

`GET /health`  
Digunakan untuk memeriksa status aplikasi.

`GET /api/results`  
Mengembalikan hasil pengolahan prakiraan terbaru dari database D1 dalam format JSON.

`GET /api/status`  
Mengembalikan riwayat eksekusi pipeline dari database D1.

`GET /api/history` *(ditambahkan pada Revisi V1.1)*  
Mengembalikan snapshot hasil analisis historis satu tahun dari Cloudflare R2 dalam format JSON.

`POST /admin/run`  
Menjalankan pipeline prakiraan secara manual menggunakan `ADMIN_TOKEN` melalui header `x-admin-token`.

Hasil pengolahan ditampilkan melalui dashboard web pada rute utama `/` (prakiraan & status pipeline) serta `/history` (ringkasan dan grafik tren historis satu tahun).

## 7. Jadwal dan Pengolahan Data

Pipeline prakiraan dijadwalkan berjalan satu kali sehari pada pukul 07.00 WIB menggunakan Cloudflare Cron Trigger.

Cron expression:
`0 0 * * *`

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

Jika API sumber tidak dapat diakses atau data tidak valid, Worker mencatat kegagalan dalam tabel `pipeline_runs` selama koneksi database masih tersedia.

Status eksekusi:
- `running`: proses sedang berjalan.
- `success`: proses berhasil.
- `failed`: proses mengalami kegagalan.

Dashboard menggunakan data dari eksekusi terakhir yang berhasil sehingga hasil sebelumnya tetap dapat ditampilkan ketika pengambilan data baru gagal.

## 9. Kesepakatan dan Revisi

- **Versi dokumen:** 1.1 (Final)
- **Tanggal penyusunan awal:** 21 November 2026
- **Tanggal revisi terakhir:** 25 November 2026
- **Status:** Disetujui dan Aktif — Samuel Pangestu (Analysis Layer) & Muhammad Adrian (Infrastructure & Operations Layer)

Setiap perubahan sumber data, indikator, format penyimpanan, endpoint, atau jadwal pemrosesan didiskusikan dan disetujui oleh perwakilan kedua layer serta dicatat dalam riwayat revisi di bawah ini.

### Detail Revisi V1.1 (24 November 2026) — **DISETUJUI & DIIMPLEMENTASIKAN**

Revisi ini disusun berdasarkan temuan review silang (`docs/cross-review.md`) dan telah disetujui oleh **Samuel Pangestu** serta **Muhammad Adrian**:

1. **Koordinat:** Permintaan forecast memakai `latitude: -6.2088`, `longitude: 106.8456` (sesuai `WEATHER_API` di `worker.js`). Data historis satu tahun (8.760 sampel) untuk analisis berasal dari grid Open-Meteo `latitude: -6.221441`, `longitude: 106.856186` (elevasi 12 m). Keduanya mewakili wilayah Jakarta tetapi bukan titik grid yang identik.
2. **Atribusi lisensi:** Dashboard menampilkan tautan atribusi *"Weather data by Open-Meteo.com"* sesuai ketentuan lisensi CC BY 4.0.
3. **Target kinerja (target desain, angka aktual tidak diukur secara terpisah):**
   - Batas waktu job pipeline: pengambilan data memakai timeout 15 detik (konfigurasi di kode) dengan target total eksekusi ≤ 30 detik. Durasi aktual end-to-end tidak diukur secara terpisah.
   - Target respons `GET /api/results`, `GET /api/status`, dan `GET /api/history`: ≤ 1 detik. Angka latensi spesifik tidak diukur secara terpisah (diverifikasi melalui status HTTP 200 dan monitoring Cloudflare Workers).
4. **Integrasi hasil analisis historis ke dashboard:** `src/analysis/analysis.py` menghasilkan keluaran teragregasi (`summary.json`, `daily.csv`, `monthly.csv`, `trend.csv`) yang dikemas menjadi snapshot JSON `historical-dashboard.json` pada root bucket Cloudflare R2 (dibuat oleh `src/analysis/build_dashboard_data.py`), diekspos melalui endpoint `GET /api/history`, dan ditampilkan pada halaman dashboard `/history`. Pembaruan analisis historis bersifat manual (dijalankan ulang oleh **Samuel Pangestu** pada Analysis Layer), bukan terjadwal via Cron.
5. **Perilaku gagal (terverifikasi melalui pengujian):** API sumber non-2xx, JSON tidak valid, array kosong, panjang array tidak sama, atau semua nilai tidak valid menghasilkan run berstatus `failed` dengan pesan kesalahan tercatat di D1 (`docs/evidence/test-output.txt`). Dashboard dirancang menampilkan data run sukses terakhir; perilaku ini tidak diuji secara otomatis.

### Riwayat Revisi

- **V1.0 (23 November 2026):** Penyusunan kontrak awal berdasarkan implementasi pipeline prakiraan cuaca pada Cloudflare Workers, R2, dan D1 (disetujui oleh Samuel Pangestu & Muhammad Adrian).
- - **V1.1a (25 November 2026):** Koreksi dokumentasi agar sesuai implementasi — lokasi snapshot historis menjadi `historical-dashboard.json` pada root bucket R2 (sebelumnya tertulis `analysis/{tanggal}/`), dan klaim perilaku dashboard saat run gagal diberi keterangan tidak diuji otomatis (disetujui oleh Samuel Pangestu & Muhammad Adrian).
- **V1.1 (24 November 2026):** Revisi disetujui dan diimplementasikan — penambahan spesifikasi koordinat grid, atribusi lisensi Open-Meteo, batas target kinerja, perilaku penanganan kegagalan teruji, serta jalur integrasi snapshot historis R2 melalui `GET /api/history` dan rute dashboard `/history` (disetujui oleh Samuel Pangestu & Muhammad Adrian).
