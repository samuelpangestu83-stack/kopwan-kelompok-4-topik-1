
# Runbook Operasional Sistem

## 1. Gambaran Umum

Dokumen ini berisi panduan pengoperasian dan pemantauan pipeline data prakiraan cuaca Jakarta yang dibangun menggunakan layanan Cloudflare.

Sistem dirancang untuk mengambil data secara otomatis dari Open-Meteo API, menyimpan data mentah pada Cloudflare R2, mengolah data menggunakan Cloudflare Workers, dan menyimpan hasil analisis pada Cloudflare D1.

Hasil pengolahan ditampilkan melalui dashboard web yang dapat diakses menggunakan browser.

## 2. Layanan yang Digunakan

| Layanan | Fungsi |
|---|---|
| Cloudflare Workers | Menjalankan pipeline dan menyediakan dashboard |
| Cloudflare Cron Triggers | Mengatur jadwal otomatis |
| Cloudflare R2 | Menyimpan data JSON mentah |
| Cloudflare D1 | Menyimpan hasil pengolahan dan riwayat eksekusi |
| Cloudflare Observability | Memantau log dan aktivitas Worker |
| Open-Meteo API | Menyediakan data prakiraan cuaca |

Konfigurasi utama:

- Worker: topik1-cuaca-serverless
- Database D1: topik1-cuaca-db
- Bucket R2: proyekcloudcomputing
- Binding database: DB
- Binding storage: RAW
- Secret: ADMIN_TOKEN
- Cron: 0 0 * * *
- Jadwal: Setiap hari pukul 07.00 WIB

## 3. Akses Sistem

Dashboard dapat diakses melalui:

https://topik1-cuaca-serverless.muhamadadrian279.workers.dev/

Endpoint yang digunakan:

| Endpoint | Fungsi |
|---|---|
| GET / | Menampilkan dashboard |
| GET /health | Memeriksa status aplikasi |
| GET /api/results | Menampilkan hasil analisis terbaru |
| GET /api/status | Menampilkan riwayat eksekusi |
| POST /admin/run | Menjalankan pipeline secara manual |

Endpoint /admin/run hanya dapat digunakan dengan ADMIN_TOKEN yang benar.

## 4. Cara Menjalankan Sistem

### 4.1 Menjalankan Secara Otomatis

Pipeline dijalankan menggunakan Cloudflare Cron Triggers.

Pengaturan jadwal:

0 0 * * *

Jadwal tersebut berarti Worker dijalankan setiap hari pukul 00.00 UTC atau 07.00 WIB.

Untuk memeriksa pengaturannya:

1. Login ke Cloudflare Dashboard.
2. Pilih Workers & Pages.
3. Buka topik1-cuaca-serverless.
4. Masuk ke Settings.
5. Pilih Trigger events.
6. Periksa konfigurasi Cron Triggers.

Selama jadwal aktif, pipeline tidak memerlukan perintah manual dari laptop.

### 4.2 Menjalankan Secara Manual

Pipeline dapat dijalankan melalui Windows PowerShell untuk keperluan pengujian atau pemulihan.

Gunakan perintah berikut:

    $token = Read-Host "Masukkan ADMIN_TOKEN"

    Invoke-RestMethod `
      -Method POST `
      -Uri "https://topik1-cuaca-serverless.muhamadadrian279.workers.dev/admin/run" `
      -Headers @{"x-admin-token" = $token}

    Remove-Variable token

Token harus sesuai dengan Secret yang tersimpan pada Cloudflare Worker.

Jangan menyimpan token dalam kode GitHub atau menampilkannya pada screenshot.

Jika berhasil, sistem mengembalikan status ok: true serta informasi run_id, days, dan skipped.

## 5. Pemeriksaan Hasil Pipeline

### 5.1 Memeriksa R2 Storage

1. Buka Cloudflare Dashboard.
2. Masuk ke R2 Object Storage.
3. Pilih bucket proyekcloudcomputing.
4. Buka folder raw.
5. Periksa file JSON berdasarkan run_id.

File JSON tersebut merupakan data mentah yang diperoleh dari Open-Meteo API.

### 5.2 Memeriksa Database D1

Buka D1 SQLite Database, pilih topik1-cuaca-db, kemudian masuk ke Console.

Untuk melihat riwayat pipeline, jalankan:

    SELECT started_at, status, row_count, error_message
    FROM pipeline_runs
    ORDER BY started_at DESC
    LIMIT 10;

Untuk melihat hasil pengolahan terbaru:

    SELECT forecast_date, avg_temperature,
           avg_humidity, total_precipitation
    FROM daily_forecast
    ORDER BY forecast_date DESC
    LIMIT 10;

Hasil dari tabel daily_forecast digunakan oleh dashboard untuk menampilkan informasi prakiraan cuaca.

### 5.3 Memeriksa Dashboard

Buka alamat dashboard menggunakan browser.

Pastikan terdapat:
- Ringkasan suhu, kelembapan, dan curah hujan.
- Grafik ketiga indikator.
- Tabel hasil pengolahan.
- Informasi waktu pembaruan terakhir.

Tombol Perbarui Tampilan digunakan untuk membaca ulang hasil dari database, bukan untuk menjalankan pipeline baru.

## 6. Monitoring Sistem

Monitoring dilakukan melalui Cloudflare Observability.

Langkah pemeriksaan:

1. Buka Worker topik1-cuaca-serverless.
2. Pilih Observability.
3. Buka Invocations untuk melihat eksekusi Worker.
4. Periksa Origin scheduled untuk eksekusi otomatis.
5. Buka Events untuk melihat pesan log.

Pesan yang digunakan dalam monitoring:

- pipeline_success: proses berhasil.
- pipeline_failed: proses mengalami kegagalan.
- results_failed: gagal membaca hasil database.
- status_failed: gagal membaca riwayat eksekusi.

Status pada database juga diperiksa untuk memastikan proses benar-benar selesai.

## 7. Penanganan Kegagalan

Jika pipeline mengalami kegagalan, lakukan pemeriksaan berikut:

1. Buka Cloudflare Observability.
2. Periksa pesan error pada Worker.
3. Buka tabel pipeline_runs di D1.
4. Periksa kolom error_message.
5. Identifikasi apakah kegagalan berasal dari API, format data, storage, atau database.
6. Lakukan perbaikan sesuai sumber masalah.
7. Jalankan ulang pipeline secara manual.
8. Pastikan status berubah menjadi success pada eksekusi baru.

Jika API tidak dapat diakses, periksa respons dan ketersediaan layanan sumber data.

Jika data tidak valid, periksa struktur JSON dan indikator yang diterima.

Jika terjadi masalah penyimpanan, periksa binding DB dan RAW serta ketersediaan layanan terkait.

Ketika eksekusi gagal, dashboard tetap membaca data dari eksekusi terakhir yang berhasil.

## 8. Pengujian Kegagalan dan Pemulihan

Pengujian dilakukan dengan menambahkan mode simulasi kegagalan API sementara pada Worker.

Hasil pengujian:

- Permintaan simulasi menghasilkan HTTP 502.
- Status failed berhasil dicatat pada tabel pipeline_runs.
- Pesan kesalahan menunjukkan bahwa API sumber data tidak dapat diakses.
- Pipeline dapat dijalankan kembali melalui endpoint admin.
- Eksekusi pemulihan berhasil memproses tiga hari prakiraan.

Setelah pengujian selesai, kode simulasi dihapus dan Worker dikembalikan ke versi normal.

Pengujian ini menunjukkan bahwa sistem dapat mencatat kegagalan dan dijalankan kembali setelah terjadi masalah.

## 9. Pemeliharaan Sistem

Pemeliharaan sistem meliputi:

- Memeriksa riwayat eksekusi Cron.
- Memastikan data terbaru tersimpan pada R2 dan D1.
- Memantau error melalui Cloudflare Observability.
- Memeriksa penggunaan layanan dan biaya.
- Meninjau konfigurasi keamanan.
- Memperbarui kode apabila terjadi perubahan struktur API sumber.

Perubahan kode dilakukan melalui editor Cloudflare Workers dan diterapkan menggunakan Deploy.

Kode yang sudah diuji juga disimpan pada repository GitHub kelompok agar dapat digunakan kembali.

## 10. Penghentian Layanan

Apabila sistem tidak lagi digunakan:

1. Nonaktifkan atau hapus Cron Trigger.
2. Simpan data dan bukti pengujian yang diperlukan.
3. Periksa resource R2 dan D1.
4. Hapus resource yang tidak diperlukan setelah memastikan data penting telah dicadangkan.
5. Periksa kembali penggunaan dan tagihan Cloudflare.

Langkah ini dilakukan untuk mencegah penggunaan resource yang tidak diperlukan setelah proyek selesai.

## 11. Kesimpulan

Berdasarkan hasil implementasi dan pengujian, pipeline dapat dijalankan secara manual maupun otomatis menggunakan Cloudflare Workers.

Data mentah disimpan pada R2, hasil pengolahan disimpan pada D1, dan dashboard menampilkan ringkasan serta grafik prakiraan cuaca.

Sistem juga memiliki pencatatan eksekusi dan mekanisme penanganan kegagalan yang telah diuji melalui simulasi API tidak dapat diakses.

