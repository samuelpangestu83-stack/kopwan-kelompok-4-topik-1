# Evidence

Folder bukti. Tandai `[x]` setelah file benar-benar ada. **Jangan tampilkan ADMIN_TOKEN, API token, atau account ID penuh pada screenshot.**

Pembagian penanggung jawab:
- **Samuel**: Analysis Layer
- **Adrian**: Infrastructure & Operations Layer

## Sudah ada
- [x] `test-output.txt`: keluaran `node src/app/tests/worker.test.mjs` (18 lulus), mencakup API down, data kosong, format salah, nilai tidak valid, otorisasi admin (Adrian)
- [x] `worker-overview.png`: halaman Overview Worker (binding `DB` dan `RAW`, Workers Logs aktif, metrik 24 jam, riwayat deployment manual lewat dashboard) (Adrian)
- [x] `analysis-run.txt`: keluaran ringkas `python src/analysis/analysis.py` (Samuel)

## Harus diambil dari Cloudflare (belum ada)

Monitoring dan biaya (Adrian):
- [ ] `workers-usage.png`: penggunaan Workers
- [ ] `d1-usage.png`: penggunaan D1
- [ ] `r2-usage.png`: penggunaan R2
- [ ] `billing-overview.png`: Billing, Billable Usage
- [ ] `cron-scheduled.png`: invokasi Origin *scheduled* di Observability (bukti eksekusi otomatis)
- [ ] `observability-events.png`: log `pipeline_success` / `pipeline_failed`

Pengujian (Adrian):
- [ ] `failure-simulation.png`: run `failed` di `pipeline_runs` dan respons HTTP 502
- [ ] `recovery-run.png`: run `success` sesudahnya

Teardown (Adrian), diambil **sesudah** presentasi:
- [ ] `teardown-worker-deleted.png`
- [ ] `teardown-r2-deleted.png`
- [ ] `teardown-d1-deleted.png`
- [ ] `teardown-billing-final.png`: biaya final; salin angkanya ke `cost-report.md` sebagai realisasi akhir
