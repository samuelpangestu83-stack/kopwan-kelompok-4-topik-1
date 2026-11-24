
# Interface Contract — Analysis Layer dan Infrastructure & Operations

## 1. Tujuan

Dokumen ini menjelaskan kesepakatan teknis antara Analysis Layer dan Infrastructure & Operations Layer mengenai struktur data, hasil pemrosesan, endpoint, jadwal, target kinerja, dan penanganan kegagalan.

Kontrak digunakan agar output analisis dapat diterima dan ditampilkan oleh sistem Cloudflare secara konsisten.

## 2. Pembagian Tanggung Jawab

| Layer | Tanggung Jawab |
|---|---|
| Analysis Layer | Persiapan data, validasi, analisis, interpretasi, dan snapshot historis |
| Infrastructure & Operations | Worker, API, D1, R2, dashboard, monitoring, dan deployment |

## 3. Sumber dan Struktur Data

Kedua jalur menggunakan Open-Meteo dengan tiga indikator:

| Indikator | Field | Satuan |
|---|---|---|
| Suhu | `temperature_2m` | °C |
| Kelembapan | `relative_humidity_2m` | % |
| Curah hujan | `precipitation` | mm |

### Data Forecast

- Periode: prakiraan tiga hari.
- Interval: per jam.
- Koordinat: -6.2088, 106.8456.
- Format: JSON.
- Zona waktu: Asia/Jakarta.

Input menggunakan array `hourly.time`, `hourly.temperature_2m`, `hourly.relative_humidity_2m`, dan `hourly.precipitation`.

Seluruh array wajib tersedia, tidak kosong, dan memiliki panjang yang sama.

### Data Historis

- Periode: 16 November 2025–15 November 2026.
- Data valid: 8.760 sampel per jam.
- Ringkasan: 365 hari.
- Ringkasan bulanan: 13 kelompok bulan/parsial.
- Format snapshot: JSON.
- Koordinat grid historis sekitar -6.221441, 106.856186.

Data historis merupakan keluaran model/reanalisis Open-Meteo, bukan pengukuran langsung stasiun BMKG.

## 4. Kontrak Penyimpanan

| Data | Penyimpanan | Lokasi |
|---|---|---|
| JSON forecast mentah | R2 | `raw/{run_id}.json` |
| Hasil prakiraan | D1 | `daily_forecast` |
| Riwayat pipeline | D1 | `pipeline_runs` |
| Hasil analisis historis | R2 | `historical-dashboard.json` |

Snapshot historis memuat:

- `metadata`
- `validation`
- `descriptive`
- `trend`
- `season_test`
- `daily`
- `monthly`

File historis diunggah secara manual ke root R2, bukan melalui Cron forecast.

## 5. Kontrak Endpoint

| Method | Endpoint | Output |
|---|---|---|
| GET | `/` | Dashboard prakiraan |
| GET | `/history` | Dashboard historis |
| GET | `/health` | Status layanan |
| GET | `/api/results` | JSON hasil forecast terbaru |
| GET | `/api/status` | Riwayat pipeline |
| GET | `/api/history` | JSON historis |
| GET | `/api/history/csv` | File CSV harian |
| POST | `/admin/run` | Menjalankan pipeline manual |

Endpoint admin membutuhkan header `x-admin-token`.

## 6. Jadwal dan Target Kinerja

Jadwal yang dikonfigurasi adalah:

`0 0 * * *` UTC atau 07.00 WIB setiap hari.

Worker menggunakan timeout pengambilan data Open-Meteo sebesar 15 detik.

Target kinerja yang diusulkan:

| Indikator | Target | Status |
|---|---|---|
| Durasi satu pipeline | Maksimal 30 detik | Belum diukur |
| Respons `/api/results` | Maksimal 1 detik | Belum diukur |
| Keberhasilan Cron harian | Satu eksekusi per hari | Perlu verifikasi terbaru |

Target tersebut merupakan usulan yang masih perlu disepakati dan diuji, bukan hasil pengukuran.

## 7. Penanganan Kegagalan

| Kondisi | Tindakan |
|---|---|
| API tidak merespons | Pipeline gagal dan mencatat error jika D1 tersedia |
| JSON tidak sesuai format | Proses dibatalkan |
| Sebagian nilai tidak valid | Sampel dilewati |
| Seluruh nilai tidak valid | Pipeline dinyatakan gagal |
| Pipeline terbaru gagal | Dashboard tetap memakai hasil sukses terakhir |
| File historis tidak ditemukan | `/api/history` mengembalikan 404 |
| Token admin tidak benar | Mengembalikan 401 Unauthorized |

## 8. Riwayat Revisi

| Versi | Tanggal | Perubahan | Status |
|---|---|---|---|
| V1.0 | 23 November 2026 | Pipeline forecast dengan R2 dan D1 | Draf awal |
| V1.1 | 24 November 2026 | Usulan integrasi historis melalui D1 | Usulan, tidak diterapkan |
| V1.2 | 25 November 2026 | Integrasi historis menggunakan snapshot JSON di R2 | Revisi teknis, menunggu persetujuan |

## 9. Persetujuan Kedua Layer

**Perwakilan Analysis Layer:** [Nama, NIM, tanggal]

**Perwakilan Infrastructure & Operations:** [Nama, NIM, tanggal]

**Status persetujuan:** Menunggu pemeriksaan dan persetujuan kedua layer.

Persetujuan dicatat setelah kedua pihak benar-benar memeriksa kontrak dan implementasinya.
