# Evidence

Folder bukti. Tandai `[x]` setelah file benar-benar ada. **Jangan tampilkan ADMIN_TOKEN, API token, atau account ID penuh pada screenshot.**

## Sudah ada
- [x] `test-output.txt`: keluaran `node src/app/tests/worker.test.mjs` (18 lulus), mencakup API down, data kosong, format salah, nilai tidak valid, otorisasi admin (Anggota 4)
- [x] `worker-overview.png`: halaman Overview Worker (binding `DB` dan `RAW`, Workers Logs aktif, metrik 24 jam, riwayat deployment manual lewat dashboard)
- [x] `analysis-run.txt`: keluaran ringkas `python src/analysis/analysis.py` (Anggota 1)

## Harus diambil dari Cloudflare (belum ada)
Nama file mengikuti rujukan di `docs/cost-report.md` bagian 12.

Monitoring dan biaya (Anggota 5):
- [ ] `workers-usage.png`: penggunaan Workers
- [ ] `d1-usage.png`: penggunaan D1
- [ ] `r2-usage.png`: penggunaan R2
- [ ] `billing-overview.png`: Billing, Billable Usage
- [ ] `cron-scheduled.png`: invokasi Origin *scheduled* di Observability (bukti eksekusi otomatis)
- [ ] `observability-events.png`: log `pipeline_success` / `pipeline_failed`

Pengujian (Anggota 4):
- [ ] `failure-simulation.png`: run `failed` di `pipeline_runs` dan HTTP 502 (hasil simulasi di `runbook.md` bagian 8)
- [ ] `recovery-run.png`: run `success` sesudahnya

Teardown (Anggota 3), diambil **sesudah** presentasi:
- [ ] `teardown-worker-deleted.png`
- [ ] `teardown-r2-deleted.png`
- [ ] `teardown-d1-deleted.png`
- [ ] `teardown-billing-final.png`: biaya final; salin angkanya ke `cost-report.md` sebagai realisasi akhir
