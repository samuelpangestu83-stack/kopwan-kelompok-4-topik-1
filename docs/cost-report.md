
# Cost Report
## Pipeline Data Terbuka Serverless dan Dashboard

**Topik:** 1 — Pipeline Data Terbuka Serverless dan Dashboard  
**Platform Cloud:** Cloudflare  
**Service Model:** Function as a Service (FaaS)  
**Tanggal Pengamatan:** 23 November 2026  
**Status:** Final berdasarkan pengamatan awal

---

## 1. Gambaran Umum

Laporan ini disusun untuk memperkirakan kebutuhan biaya cloud serta membandingkannya dengan penggunaan aktual selama proses implementasi dan pengujian sistem.

Proyek menggunakan Cloudflare Workers sebagai layanan Function as a Service (FaaS) untuk mengambil dan mengolah data prakiraan cuaca Jakarta dari Open-Meteo API.

Data mentah disimpan menggunakan Cloudflare R2 Object Storage, sedangkan hasil pengolahan dan riwayat eksekusi disimpan pada Cloudflare D1 Database.

Penggunaan arsitektur serverless dipilih agar sistem dapat berjalan secara otomatis tanpa memerlukan Virtual Machine yang harus dikelola secara terus-menerus.

## 2. Layanan Cloud yang Digunakan

| Layanan | Fungsi | Model Layanan |
|---|---|---|
| Cloudflare Workers | Pengambilan data, pengolahan, API, dan dashboard | FaaS |
| Cron Triggers | Menjalankan pipeline secara otomatis | Scheduled Trigger |
| Cloudflare R2 | Menyimpan data JSON mentah | Managed Object Storage |
| Cloudflare D1 | Menyimpan hasil analisis dan riwayat pipeline | Managed Database |
| Cloudflare Observability | Memantau eksekusi dan mencatat error | Monitoring |

Seluruh layanan digunakan dalam lingkungan Cloudflare sehingga proses pengambilan, penyimpanan, pengolahan, dan penyajian data dapat saling terintegrasi.

## 3. Estimasi Kebutuhan Bulanan

Estimasi dihitung berdasarkan skenario operasional selama 30 hari.

Asumsi yang digunakan:

- Pipeline dijalankan otomatis satu kali setiap hari.
- Jadwal pengambilan data adalah pukul 07.00 WIB.
- Setiap eksekusi mengambil data prakiraan cuaca selama tiga hari.
- Setiap eksekusi berhasil menyimpan satu file JSON ke R2.
- Tiga baris ringkasan prakiraan disimpan ke D1.
- Dashboard diasumsikan menerima 20 kunjungan setiap hari.
- Setiap kunjungan menghasilkan sekitar tiga request ke Worker.

### 3.1 Estimasi Cloudflare Workers

Perhitungan eksekusi otomatis:

30 hari × 1 eksekusi = **30 eksekusi/bulan**

Perhitungan request dashboard:

20 kunjungan × 3 request × 30 hari = **1.800 request/bulan**

Total perkiraan pemanggilan Worker:

30 + 1.800 = **1.830 pemanggilan/bulan**

Estimasi ini belum termasuk pengujian manual, retry, dan aktivitas administrator.

### 3.2 Estimasi Cloudflare R2

Setiap eksekusi berhasil menyimpan satu file JSON mentah.

30 eksekusi × 1 file = **30 file/bulan**

Dengan asumsi ukuran rata-rata satu file sebesar 10 kB:

30 × 10 kB = **300 kB data baru/bulan**

Ukuran file tersebut merupakan asumsi perencanaan, bukan hasil pengukuran aktual.

Biaya penyimpanan R2 dihitung berdasarkan penggunaan GB-month, bukan hanya jumlah data baru yang disimpan.

### 3.3 Estimasi Cloudflare D1

Setiap eksekusi menghasilkan tiga baris ringkasan prakiraan harian.

30 eksekusi × 3 baris = **90 baris/bulan**

Selain hasil analisis, sistem juga mencatat riwayat eksekusi pipeline.

| Aktivitas Database | Estimasi Bulanan |
|---|---:|
| INSERT hasil prakiraan | 90 baris |
| INSERT riwayat eksekusi | 30 baris |
| UPDATE status eksekusi | 30 perubahan |
| **Total perubahan baris utama** | **150** |

Perhitungan ini merupakan estimasi operasi logis. Jumlah rows written yang dihitung Cloudflare dapat berbeda karena aktivitas indeks dan operasi database lainnya.

## 4. Estimasi Biaya Awal

Estimasi biaya didasarkan pada penggunaan Cloudflare Free Plan.

| Layanan | Estimasi Penggunaan | Estimasi Biaya |
|---|---|---:|
| Cloudflare Workers | 1.830 pemanggilan/bulan | US$0.00 |
| Cloudflare R2 | Sekitar 30 file JSON baru | US$0.00 |
| Cloudflare D1 | Sekitar 150 perubahan baris utama | US$0.00 |
| Cron Triggers | 1 jadwal harian | Termasuk Workers |
| Dashboard | Dihosting menggunakan Worker | Termasuk Workers |
| **Total** | | **US$0.00** |

Total estimasi biaya tambahan adalah **US$0.00 per bulan**, dengan asumsi seluruh penggunaan tetap berada dalam kuota gratis dan tidak terdapat layanan berbayar tambahan.

### 4.1 Kuota Gratis Cloudflare

| Layanan | Kuota Gratis |
|---|---:|
| Workers Requests | 100.000 request/hari |
| D1 Rows Read | 5.000.000 baris/hari |
| D1 Rows Written | 100.000 baris/hari |
| D1 Storage | 5 GB |
| R2 Standard Storage | 10 GB-month/bulan |
| R2 Class A Operations | 1.000.000 operasi/bulan |
| R2 Class B Operations | 10.000.000 operasi/bulan |

Sumber: Dokumentasi resmi Cloudflare Workers, D1, dan R2.

## 5. Penggunaan Aktual Cloudflare

Data penggunaan aktual diperoleh melalui Cloudflare Dashboard pada **23 November 2026**.

Angka yang dicatat merupakan penggunaan sampai waktu pengamatan dan bukan penggunaan selama satu bulan penuh.

### 5.1 Cloudflare Workers

Cloudflare Workers digunakan untuk menjalankan pipeline otomatis, menyediakan endpoint API, serta menampilkan dashboard.

Hasil penggunaan:

| Komponen | Penggunaan Aktual |
|---|---:|
| Requests Today | 64 |
| Kuota Request Harian | 100.000 |
| Observability Events Today | 25 |
| Kuota Observability Events | 200.000 |
| Requests pada Kartu Worker | 68 |

Persentase penggunaan request harian:

**64 / 100.000 × 100% = 0,064%**

Berdasarkan perhitungan tersebut, penggunaan Cloudflare Workers masih berada jauh di bawah kuota gratis harian.

Angka 68 requests pada kartu Worker merupakan metrik dari tampilan berbeda sehingga tidak dijumlahkan dengan 64 requests pada metrik harian.

### 5.2 Cloudflare D1 Database

D1 digunakan untuk menyimpan data hasil pengolahan pada tabel `daily_forecast` dan riwayat eksekusi pada tabel `pipeline_runs`.

Hasil penggunaan:

| Komponen | Penggunaan Aktual |
|---|---:|
| Total Database | 1 |
| Rows Read | 195 |
| Rows Written | 46 |
| Total Storage | 32,77 kB |
| Metered Storage | 136,53 B-mo |
| Billable Usage | US$0.00 |

Persentase penggunaan Rows Read:

**195 / 5.000.000 × 100% = 0,0039%**

Persentase penggunaan Rows Written:

**46 / 100.000 × 100% = 0,046%**

Penggunaan database masih berada jauh di bawah batas gratis.

Pada saat pengamatan, Cloudflare D1 belum menghasilkan biaya tambahan yang dapat ditagihkan.

### 5.3 Cloudflare R2 Object Storage

Cloudflare R2 digunakan untuk menyimpan respons JSON mentah dari Open-Meteo API.

Hasil penggunaan:

| Komponen | Penggunaan Aktual |
|---|---:|
| Class A Operations | 24 |
| Class B Operations | 18 |
| Total Storage | 2,71 kB |
| Billable Usage | US$0.00 |

Persentase penggunaan Class A:

**24 / 1.000.000 × 100% = 0,0024%**

Persentase penggunaan Class B:

**18 / 10.000.000 × 100% = 0,00018%**

Hasil tersebut menunjukkan bahwa penggunaan operasi R2 masih sangat kecil dibandingkan kuota gratis.

Pada saat pengamatan, penggunaan R2 belum menghasilkan biaya tambahan.

## 6. Biaya Aktual Berdasarkan Billing

Pemeriksaan dilakukan melalui menu:

**Cloudflare Dashboard → Billing → Billable Usage**

Tanggal pengamatan: **23 November 2026**

Hasil yang tercatat:

| Komponen Billing | Hasil |
|---|---:|
| Total Cost | US$0.00 |
| Average Daily Cost | US$0.00 |
| R2 Billable Usage | US$0.00 |
| D1 Billable Usage | US$0.00 |
| Budget Alerts | 1 terkonfigurasi |

Berdasarkan data Billing Cloudflare, total biaya aktual yang teramati adalah:

### Total Biaya Aktual: US$0.00

Hasil tersebut menunjukkan bahwa selama periode pengamatan, penggunaan layanan belum menghasilkan biaya yang dapat ditagihkan.

Namun, nilai ini merupakan hasil pengamatan pada 23 November 2026 dan bukan total tagihan final satu bulan.

## 7. Perbandingan Estimasi dan Aktual

Perbandingan dilakukan untuk mengetahui apakah penggunaan layanan sesuai dengan perencanaan biaya awal.

| Layanan | Estimasi Biaya Bulanan | Biaya Aktual Teramati |
|---|---:|---:|
| Cloudflare Workers | US$0.00 | Tidak ada biaya akun yang teramati |
| Cloudflare D1 | US$0.00 | US$0.00 |
| Cloudflare R2 | US$0.00 | US$0.00 |
| **Total** | **US$0.00** | **US$0.00** |

Rumus perhitungan selisih biaya:

**Selisih Biaya = Biaya Aktual - Biaya Estimasi**

Perhitungan berdasarkan angka yang tersedia:

US$0.00 - US$0.00 = **US$0.00**

Hasil tersebut menunjukkan bahwa biaya yang teramati masih sesuai dengan estimasi awal.

Meskipun demikian, estimasi awal mencakup 30 hari, sedangkan biaya aktual baru diperoleh dari pengamatan satu hari.

Oleh karena itu, perbandingan ini digunakan sebagai evaluasi awal dan belum menunjukkan realisasi biaya bulanan secara penuh.

## 8. Analisis Efisiensi Biaya

Berdasarkan hasil implementasi, penggunaan arsitektur serverless cukup sesuai untuk kebutuhan pipeline data yang memiliki frekuensi pengambilan relatif rendah.

Cloudflare Workers memungkinkan proses pengambilan dan pengolahan data dijalankan berdasarkan jadwal maupun HTTP request.

Dengan layanan tersebut, kelompok tidak perlu menyediakan dan mengelola Virtual Machine yang harus aktif sepanjang waktu.

Cloudflare R2 digunakan untuk menyimpan data mentah dalam format JSON, sedangkan D1 menyimpan hasil pengolahan yang dibutuhkan dashboard.

Hasil penggunaan menunjukkan bahwa jumlah request, operasi penyimpanan, dan aktivitas database masih berada jauh di bawah kuota gratis masing-masing layanan.

Biaya aktual sebesar US$0.00 pada saat pengamatan juga menunjukkan bahwa kebutuhan implementasi dan pengujian awal dapat dipenuhi tanpa biaya tambahan yang tercatat.

Namun, efisiensi biaya dalam jangka panjang tetap bergantung pada jumlah eksekusi pipeline, pertumbuhan data, serta jumlah pengguna dashboard.

## 9. Risiko Peningkatan Biaya

Beberapa kondisi yang dapat meningkatkan penggunaan layanan cloud antara lain:

1. Peningkatan frekuensi pengambilan data melalui Cron Trigger.
2. Bertambahnya jumlah pengguna dashboard.
3. Penambahan indikator dan ukuran data yang diproses.
4. Akumulasi file JSON mentah pada Cloudflare R2.
5. Peningkatan jumlah operasi baca dan tulis pada D1.
6. Perubahan paket layanan atau penggunaan fitur berbayar.

Untuk mengurangi risiko tersebut, pipeline menggunakan jadwal pengambilan data satu kali sehari.

Penggunaan layanan juga dapat dipantau melalui halaman Metrics, Usage, dan Billing Cloudflare.

Budget Alert digunakan untuk membantu memberikan pemberitahuan penggunaan biaya, tetapi tidak dianggap sebagai mekanisme penghentian tagihan otomatis.

## 10. Rekomendasi Pengelolaan Biaya

Berdasarkan hasil implementasi dan pengamatan, beberapa langkah yang disarankan adalah:

1. Mempertahankan jadwal pengambilan data satu kali sehari selama kebutuhan analisis belum berubah.
2. Melakukan pemantauan penggunaan Workers, R2, dan D1 secara berkala.
3. Memeriksa Billing untuk memastikan tidak terdapat biaya yang tidak direncanakan.
4. Menentukan kebijakan retensi data mentah apabila kapasitas penyimpanan meningkat.
5. Menghindari peningkatan paket layanan sebelum kapasitas tambahan benar-benar dibutuhkan.
6. Memperbarui estimasi biaya apabila terjadi peningkatan beban kerja.

Langkah tersebut bertujuan menjaga penggunaan sumber daya tetap sesuai dengan kebutuhan proyek.

## 11. Kesimpulan

Berdasarkan estimasi dan data penggunaan aktual, pemanfaatan Cloudflare Workers, R2, dan D1 dinilai sesuai untuk proyek pipeline data terbuka serverless dengan beban kerja yang relatif kecil.

Estimasi biaya tambahan selama 30 hari adalah US$0.00, dengan asumsi seluruh penggunaan berada dalam kuota gratis.

Pada pengamatan tanggal 23 November 2026, Cloudflare Workers mencatat 64 request harian, sedangkan D1 mencatat 195 rows read dan 46 rows written.

Pada layanan R2, tercatat 24 operasi Class A dan 18 operasi Class B.

Penggunaan penyimpanan juga masih relatif kecil, yaitu 32,77 kB untuk D1 dan 2,71 kB untuk R2.

Hasil pemeriksaan Billing Cloudflare menunjukkan bahwa total biaya aktual yang teramati adalah **US$0.00**.

Hasil tersebut mendukung estimasi bahwa arsitektur serverless mampu memenuhi kebutuhan proyek pada skala pengujian saat ini tanpa biaya tambahan yang tercatat.

Namun, pemantauan tetap diperlukan untuk memastikan penggunaan layanan tetap efisien apabila sistem dijalankan dalam periode yang lebih panjang.

## 12. Bukti Pendukung

Bukti penggunaan dan pemantauan biaya disimpan pada direktori `docs/evidence/`.

| File Bukti | Keterangan |
|---|---|
| `r2-usage.png` | Penggunaan R2 Object Storage |
| `d1-usage.png` | Penggunaan D1 Database |
| `workers-usage.png` | Penggunaan Cloudflare Workers |
| `billing-overview.png` | Total biaya pada Cloudflare Billing |
| `cron-scheduled.png` | Bukti eksekusi pipeline otomatis |

File tersebut digunakan untuk mendukung angka penggunaan aktual dan hasil evaluasi biaya yang disajikan dalam laporan.

## 13. Referensi

1. Cloudflare. [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
2. Cloudflare. [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
3. Cloudflare. [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
4. Cloudflare. [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
5. Cloudflare. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

**Sumber data aktual:** Cloudflare Dashboard kelompok, 23 November 2026.

