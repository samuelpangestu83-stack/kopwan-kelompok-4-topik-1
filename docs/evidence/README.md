# Evidence

Folder bukti. Tandai `[x]` setelah file benar-benar ada. **Jangan tampilkan ADMIN_TOKEN, API token, atau account ID penuh pada screenshot.**

Penanggung jawab:
- **Samuel**: Analysis Layer
- **Adrian**: Infrastructure & Operations Layer

## Sudah ada
- [x] `test-output.txt`: keluaran `node src/app/tests/worker.test.mjs` (18 lulus), mencakup API down, data kosong, format salah, nilai tidak valid, otorisasi admin (Adrian)
- [x] `analysis-run.txt`: keluaran ringkas `python src/analysis/analysis.py` (Samuel)
- [x] `worker-overview.png`: halaman Overview Worker (binding `DB` dan `RAW`, Workers Logs aktif, metrik 24 jam, riwayat deployment manual lewat dashboard) (Adrian)
- [x] `worker-overview-latest.png`: Overview Worker setelah deployment terbaru (binding `DB` dan `RAW`, Workers Logs aktif, 1 trigger, 100 invocation, 0 error) (Adrian)
- [x] `history-dashboard.png`: tampilan live halaman `/history` dengan snapshot historis dari R2 (Samuel dan Adrian)
- [x] `cron-scheduled.png`: Observability, eksekusi Cron 24 Nov 2026 pukul 07.00 WIB dan log `pipeline_success`; diambil sebelum deployment terbaru (Samuel)
- [x] `workers-usage.png`: tab Metrics Workers, 24 jam terakhir (Samuel)

## Harus diambil dari Cloudflare (belum ada)

Monitoring dan biaya (Adrian):
- [ ] `d1-usage.png`: penggunaan D1
- [ ] `r2-usage.png`: penggunaan R2
- [ ] `billing-overview.png`: Billing, Billable Usage
- [ ] `cron-scheduled-latest.png`: eksekusi Cron setelah deployment terbaru (cek pukul 07.00 WIB hari berikutnya)
- [ ] `observability-events.png`: log `pipeline_failed` (log `pipeline_success` sudah terlihat di `cron-scheduled.png`)

Pengujian (Adrian):
- [ ] `failure-simulation.png`: run `failed` di `pipeline_runs` dan HTTP 502 (hasil simulasi di `runbook.md` bagian 14)
- [ ] `recovery-run.png`: run `success` sesudahnya

Teardown (Adrian), diambil **sesudah** presentasi:
- [ ] `teardown-worker-deleted.png`
- [ ] `teardown-r2-deleted.png`
- [ ] `teardown-d1-deleted.png`
- [ ] `teardown-billing-final.png`: biaya final; salin angkanya ke `cost-report.md` sebagai realisasi akhir
