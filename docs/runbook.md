
# Runbook — Cloudflare Serverless Pipeline

## 1. Tujuan

Runbook ini digunakan sebagai panduan untuk menjalankan, memantau, menguji, dan menangani masalah pada pipeline data cuaca berbasis Cloudflare.

## 2. Informasi Layanan

| Komponen | Konfigurasi |
|---|---|
| Cloudflare Worker | `topik1-cuaca-serverless` |
| D1 Database | `topik1-cuaca-db` |
| D1 Binding | `DB` |
| R2 Bucket | `proyekcloudcomputing` |
| R2 Binding | `RAW` |
| Secret | `ADMIN_TOKEN` |
| Cron Trigger | `0 0 * * *` |
| Jadwal | 07.00 WIB setiap hari |

URL aplikasi:

https://topik1-cuaca-serverless.muhamadadrian279.workers.dev/

## 3. Pemeriksaan Deployment

1. Login ke Cloudflare Dashboard.
2. Buka Workers & Pages.
3. Pilih `topik1-cuaca-serverless`.
4. Periksa deployment terbaru.
5. Pastikan binding `DB` dan `RAW` masih aktif.
6. Pastikan `ADMIN_TOKEN` tersimpan sebagai Secret.
7. Periksa Cron Trigger pada pengaturan Worker.

Sebelum mengganti kode, buat backup source Worker yang sedang aktif.

## 4. Pemeriksaan Endpoint

| Endpoint | Hasil yang Diharapkan |
|---|---|
| `/health` | Status layanan `ok` |
| `/api/results` | Hasil prakiraan terbaru |
| `/api/status` | Riwayat pipeline |
| `/api/history` | JSON historis satu tahun |
| `/api/history/csv` | File CSV harian |
| `/` | Dashboard prakiraan |
| `/history` | Dashboard historis |

## 5. Menjalankan Pipeline Manual

Pipeline dapat dijalankan melalui Windows PowerShell.

```powershell
$token = Read-Host "Masukkan ADMIN_TOKEN"

Invoke-RestMethod `
  -Method POST `
  -Uri "https://topik1-cuaca-serverless.muhamadadrian279.workers.dev/admin/run" `
  -Headers @{"x-admin-token"=$token}

Remove-Variable token
```

Jika berhasil, respons menampilkan `ok: true`, jumlah hari yang diproses, dan ID eksekusi.

Pengujian harus dilakukan setelah deployment untuk membuktikan bahwa kode aktif benar-benar berfungsi.

## 6. Pemeriksaan D1 Database

Buka Cloudflare D1 Database, pilih `topik1-cuaca-db`, kemudian buka Console.

Periksa riwayat pipeline:

```sql
SELECT started_at, finished_at, status,
       row_count, error_message
FROM pipeline_runs
ORDER BY started_at DESC
LIMIT 10;
```

Periksa hasil prakiraan terakhir:

```sql
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
ORDER BY forecast_date;
```

## 7. Pemeriksaan Cloudflare R2

Buka bucket `proyekcloudcomputing`.

Pastikan terdapat dua bagian data:

- Folder `raw/` berisi hasil JSON pipeline prakiraan.
- File `historical-dashboard.json` berada pada root bucket.

File historis berasal dari hasil analisis Python dan diunggah secara manual.

Untuk menghasilkan ulang snapshot historis:

```bash
pip install -r src/analysis/requirements.txt
python src/analysis/analysis.py
python src/analysis/build_dashboard_data.py
```

Setelah berhasil, upload hasil `historical-dashboard.json` ke root bucket R2.

## 8. Monitoring

Monitoring dilakukan melalui Cloudflare Observability.

Pemeriksaan meliputi:

- Jumlah invocation Worker.
- Eksekusi dengan origin `scheduled`.
- Log `pipeline_success`.
- Log `pipeline_failed`.
- Status dan pesan error dalam D1.
- Penggunaan database dan object storage.

Cron yang telah dikonfigurasi adalah `0 0 * * *` UTC.

Keberhasilan Cron setelah pembaruan Worker perlu diverifikasi menggunakan invocation dan catatan run terbaru.

## 9. Penanganan Masalah

| Masalah | Pemeriksaan |
|---|---|
| Dashboard kosong | Periksa deployment dan data D1 |
| `/api/results` gagal | Periksa binding `DB` dan query D1 |
| `/api/history` 404 | Periksa nama file dan lokasi snapshot di R2 |
| `/history` 404 | Periksa apakah kode halaman historis sudah di-deploy |
| Pipeline gagal | Periksa log, sumber API, dan status database |
| Unauthorized | Periksa konfigurasi secret admin |
| Data tidak diperbarui | Periksa Cron dan waktu run terakhir |

Jika API sumber gagal, pipeline akan mencatat status `failed` selama D1 masih dapat diakses.

Sistem tetap menggunakan hasil dari eksekusi sukses terakhir untuk menampilkan prakiraan.

## 10. Rollback

Apabila pembaruan Worker menyebabkan masalah:

1. Buka Cloudflare Worker → Edit code.
2. Buka source backup yang disimpan sebelum pembaruan.
3. Tempel source lama.
4. Deploy ulang.
5. Periksa binding dan endpoint.
6. Jalankan pengujian manual.

Backup source tidak menggantikan backup data R2 atau D1.

## 11. Keamanan

Secret `ADMIN_TOKEN` tidak boleh disimpan di GitHub.

Gunakan token acak yang kuat, batasi akses ke akun Cloudflare, dan ganti secret jika pernah terekspos.

## 12. Penghentian Layanan

Setelah proyek selesai dipresentasikan:

1. Simpan hasil pengujian dan screenshot.
2. Nonaktifkan Cron Trigger.
3. Hapus resource yang tidak lagi diperlukan setelah disetujui kelompok.
4. Periksa Billing untuk memastikan tidak ada penggunaan lanjutan.

Penghapusan resource belum dilakukan selama proyek masih digunakan.

## 13. Status Pengujian

Pipeline awal, penyimpanan R2, D1, dan API telah diuji.

Endpoint historis berhasil membaca snapshot R2.

Pengujian dashboard final dan Cron setelah pembaruan Worker harus dicatat menggunakan bukti terbaru sebelum laporan dinyatakan selesai.
