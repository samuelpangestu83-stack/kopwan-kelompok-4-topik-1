#!/usr/bin/env bash
# Teardown resource Cloudflare setelah presentasi. JALANKAN HANYA setelah bukti
# (screenshot/log) sudah disimpan di docs/evidence/. Tindakan ini TIDAK bisa dibatalkan.
set -euo pipefail
WORKER="${WORKER_NAME:-topik1-cuaca-serverless}"
DB="${D1_DATABASE_NAME:-topik1-cuaca-db}"
BUCKET="${R2_BUCKET_NAME:-proyekcloudcomputing}"

read -r -p "Hapus Worker '$WORKER', D1 '$DB', R2 '$BUCKET'? ketik YA: " ok
[ "$ok" = "YA" ] || { echo "dibatalkan"; exit 1; }

# 1) Hentikan cron + hapus Worker (cron ikut terhapus)
npx wrangler delete --name "$WORKER"
# 2) Kosongkan lalu hapus bucket R2 (bucket harus kosong sebelum dihapus)
echo "Kosongkan objek raw/ lewat dashboard R2 atau rclone, lalu:"
npx wrangler r2 bucket delete "$BUCKET"
# 3) Hapus database D1
npx wrangler d1 delete "$DB"
echo "Selesai. Verifikasi di Billing > Billable Usage dan simpan screenshot ke docs/evidence/teardown-*.png"
