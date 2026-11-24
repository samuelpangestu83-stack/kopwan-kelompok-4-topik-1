"""Membuat snapshot historical-dashboard.json untuk dashboard /history.

Dijalankan SETELAH analysis.py. Hanya menggabungkan keluaran di output/
(summary.json, daily.csv, monthly.csv) menjadi satu berkas JSON; tidak ada
perhitungan statistik baru di sini.

    python src/analysis/build_dashboard_data.py
    python src/analysis/build_dashboard_data.py --outdir src/analysis/output --out historical-dashboard.json

Hasilnya diunggah manual ke root bucket R2 (lihat docs/runbook.md bagian 7).
"""
import argparse
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default=str(HERE / "output"))
    ap.add_argument("--out", default=None, help="default: <outdir>/historical-dashboard.json")
    a = ap.parse_args()
    outdir = Path(a.outdir)
    target = Path(a.out) if a.out else outdir / "historical-dashboard.json"

    summary = json.loads((outdir / "summary.json").read_text(encoding="utf-8"))

    # daily.csv memakai kolom 'forecast_date'; dashboard membaca kunci 'date'
    daily = pd.read_csv(outdir / "daily.csv").rename(columns={"forecast_date": "date"})
    monthly = pd.read_csv(outdir / "monthly.csv")

    period = summary["validation"]["period"]
    payload = {
        "metadata": {
            "source": "Open-Meteo Historical Weather API (model/reanalisis, bukan observasi stasiun BMKG)",
            "license": "CC BY 4.0",
            "location": "Jakarta",
            "period_start": str(daily["date"].iloc[0]),
            "period_end": str(daily["date"].iloc[-1]),
            "period_hourly": period,
            "n_days": int(len(daily)),
        },
        "daily": json.loads(daily.to_json(orient="records")),
        "monthly": json.loads(monthly.to_json(orient="records")),
        "descriptive": summary["descriptive"],
        "validation": summary["validation"],
        "trend": summary["trend"],
        "season_test": summary["season_test"],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Ditulis: {target} ({target.stat().st_size / 1024:.0f} kB, {len(daily)} hari, {len(monthly)} bulan)")


if __name__ == "__main__":
    main()
