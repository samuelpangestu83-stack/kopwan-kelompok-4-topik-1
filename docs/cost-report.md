
# Cost Report — Cloudflare Serverless Pipeline

## 1. Tujuan

Laporan biaya disusun untuk membandingkan estimasi penggunaan layanan cloud dengan biaya aktual selama implementasi dan pengujian proyek.

Platform yang digunakan adalah Cloudflare Workers, R2 Object Storage, D1 Database, dan Cron Triggers.

## 2. Layanan yang Digunakan

| Layanan | Fungsi |
|---|---|
| Workers | Eksekusi FaaS, API, dan dashboard |
| Cron Triggers | Penjadwalan pipeline otomatis |
| R2 | Penyimpanan JSON mentah dan snapshot historis |
| D1 | Hasil prakiraan dan riwayat pipeline |
| Observability | Monitoring dan log |

## 3. Estimasi Penggunaan Bulanan

Estimasi menggunakan asumsi operasional 30 hari.

- Satu eksekusi pipeline setiap hari.
- Tiga baris hasil prakiraan untuk setiap eksekusi.
- Satu file JSON baru untuk setiap eksekusi berhasil.
- Dua puluh kunjungan dashboard per hari.
- Tiga HTTP request per kunjungan sebagai asumsi perencanaan.

### 3.1 Workers

Eksekusi terjadwal:

30 × 1 = 30 eksekusi.

Request dashboard:

20 × 3 × 30 = 1.800 request.

Total perkiraan:

30 + 1.800 = **1.830 pemanggilan Worker per bulan**.

### 3.2 R2

Estimasi file mentah:

30 × 1 = 30 file baru.

Dengan asumsi 10 kB per file:

30 × 10 kB = **300 kB data baru**.

Perhitungan ini belum memasukkan data historis dan penggunaan penyimpanan sebelumnya.

### 3.3 D1

| Aktivitas | Estimasi |
|---|---:|
| INSERT hasil prakiraan | 90 |
| INSERT riwayat pipeline | 30 |
| UPDATE status pipeline | 30 |
| Total perubahan baris utama | 150 |

Nilai tersebut merupakan estimasi operasi logis. Jumlah rows written yang ditagihkan dapat berbeda.

## 4. Estimasi Biaya

| Layanan | Estimasi Biaya |
|---|---:|
| Cloudflare Workers | US$0.00 |
| Cloudflare R2 | US$0.00 |
| Cloudflare D1 | US$0.00 |
| Cron Triggers | Termasuk penggunaan Workers |
| Dashboard | Termasuk penggunaan Workers |
| **Total estimasi** | **US$0.00** |

Estimasi berlaku apabila pemakaian tetap berada dalam kuota gratis dan tidak menggunakan layanan berbayar tambahan.

## 5. Hasil Pengamatan Aktual

Pengamatan penggunaan dilakukan pada **23 November 2026**.

### 5.1 Cloudflare Workers
Pengamatan dilakukan pada **25 November 2026** melalui tab *Metrics* (rentang *Last 24 hours*) dan *Observability* (rentang *Last 1 hour*) pada Worker `topik1-cuaca-serverless`:

| Komponen | Penggunaan | Keterangan |
|---|---:|---|
| Invocations (*Last 24 hours*) | 126 | Total pemanggilan Worker (API, dashboard, dan trigger) |
| Subrequests (*Last 24 hours*) | 7 | Permintaan keluar ke `api.open-meteo.com` (status `2xx`, rata-rata 129,8 ms) |
| CPU Time (*Last 24 hours*) | 2 ms | Waktu komputasi aktif |
| Wall Time (*Last 24 hours*) | 24 ms | Total durasi eksekusi termasuk menunggu I/O jaringan |
| Observability Events (*Last 1 hour*) | 13 | 10 *Success* dan 3 *Errors* saat pengujian endpoint `/admin/run` dan `/history` |

Angka *Invocations* (126) dan *Observability Events* (13) berasal dari jendela waktu pemantauan yang berbeda sehingga tidak dijumlahkan.


| Komponen | Penggunaan |
|---|---:|
| Requests Today | 64 |
| Observability Events Today | 25 |
| Requests pada kartu Worker | 68 |

Angka 64 dan 68 berasal dari tampilan metrik berbeda dan tidak dijumlahkan.

### 5.2 Cloudflare D1

| Komponen | Penggunaan |
|---|---:|
| Total Database | 1 |
| Rows Read | 195 |
| Rows Written | 46 |
| Total Storage | 32,77 kB |
| Metered Storage | 136,53 B-mo |
| Billable Usage D1 | US$0.00 |

### 5.3 Cloudflare R2

| Komponen | Penggunaan |
|---|---:|
| Class A Operations | 24 |
| Class B Operations | 18 |
| Total Storage | 2,71 kB |
| Billable Usage R2 | US$0.00 |

Angka tersebut merupakan hasil pengamatan sebelum penambahan snapshot historis pada 25 November 2026.

## 6. Biaya Aktual

Berdasarkan Cloudflare Billing → Billable Usage pada 23 November 2026:

| Komponen | Biaya |
|---|---:|
| Total Cost | US$0.00 |
| Average Daily Cost | US$0.00 |
| D1 Billable Usage | US$0.00 |
| R2 Billable Usage | US$0.00 |

**Total biaya aktual pada periode pengamatan adalah US$0.00.**

Nilai ini bukan tagihan final satu bulan karena data Billing yang diamati hanya mencakup periode yang ditampilkan pada dashboard.

## 7. Perbandingan Estimasi dan Aktual

| Komponen | Estimasi Bulanan | Aktual Teramati |
|---|---:|---:|
| Workers | US$0.00 | Tidak ada biaya akun yang teramati |
| D1 | US$0.00 | US$0.00 |
| R2 | US$0.00 | US$0.00 |
| **Total** | **US$0.00** | **US$0.00** |

Rumus:

**Selisih = Biaya Aktual - Biaya Estimasi**

US$0.00 - US$0.00 = **US$0.00**

Selisih nominal pada pengamatan awal adalah nol.

Namun, estimasi mencakup satu bulan, sedangkan pengamatan aktual baru mencakup periode awal penggunaan. Hasil ini belum membuktikan bahwa biaya selama satu bulan penuh pasti nol.

## 8. Dampak Penambahan Data Historis

Pada 25 November 2026, sistem telah diintegrasikan dengan data historis Open-Meteo selama satu tahun.

Hasil analisis disimpan sebagai `historical-dashboard.json` pada bucket R2.

Penambahan ini meningkatkan kebutuhan penyimpanan R2 dan operasi pembacaan objek.

Dataset historis diperbarui secara manual, sehingga tidak menambah jumlah eksekusi Cron forecast harian.

Biaya setelah pembaruan belum dicatat dalam laporan ini karena screenshot Billing terbaru belum tersedia.

## 9. Evaluasi Efisiensi

Arsitektur serverless dinilai sesuai untuk beban kerja proyek saat ini karena pengambilan forecast dijalankan sekali sehari dan jumlah pengguna dashboard masih terbatas.

Cloudflare Workers mengurangi kebutuhan pengelolaan server, sedangkan D1 dan R2 menyediakan penyimpanan terkelola.

Penggunaan awal menunjukkan biaya teramati masih sebesar US$0.00.

## 10. Risiko Peningkatan Biaya

Biaya dapat meningkat apabila:

- Frekuensi pipeline bertambah.
- Jumlah pengguna dashboard meningkat.
- Operasi pembacaan D1 dan R2 bertambah.
- Data mentah terus disimpan tanpa retensi.
- Kapasitas atau paket berbayar mulai digunakan.

Pengendalian dilakukan melalui pemantauan Usage, Billing, dan Budget Alert.

## 11. Kesimpulan

Berdasarkan pengamatan 23 November 2026, sistem belum menghasilkan biaya yang dapat ditagihkan dan masih sesuai dengan estimasi awal.

Namun, penggunaan setelah penambahan dataset historis pada 25 November perlu diukur kembali.

Dengan demikian, biaya awal menunjukkan efisiensi penggunaan layanan, tetapi pemantauan tetap diperlukan sebelum menyimpulkan biaya operasional jangka panjang.

## 12. Referensi

1. Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
2. Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
3. Cloudflare D1 Pricing: https://developers.cloudflare.com/d1/platform/pricing/
4. Cloudflare R2 Pricing: https://developers.cloudflare.com/r2/pricing/

Sumber angka aktual: screenshot Cloudflare Dashboard kelompok, 23 November 2026.
