"""
Analisis deskriptif dan tren data cuaca Jakarta (Open-Meteo).
Rerunnable: python src/analysis/analysis.py [--input PATH] [--outdir PATH]

Indikator: temperature_2m (°C), relative_humidity_2m (%), precipitation (mm).
Output: output/summary.json, output/daily.csv, output/monthly.csv,
        output/trend.csv, output/validation.json, output/*.png
"""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).resolve().parent
INDICATORS = ["temperature_2m", "relative_humidity_2m", "precipitation"]


def load(path: Path) -> pd.DataFrame:
    raw = json.loads(path.read_text(encoding="utf-8"))
    h = raw["hourly"]
    df = pd.DataFrame({"time": pd.to_datetime(h["time"])})
    for c in INDICATORS:
        df[c] = pd.to_numeric(pd.Series(h[c]), errors="coerce")
    return df


def validate(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Aturan validasi sama dengan src/app/worker.js (kelembapan 0-100, hujan >= 0, nilai finite)."""
    v = {"rows_total": int(len(df))}
    v["missing"] = {c: int(df[c].isna().sum()) for c in INDICATORS}
    v["duplicate_timestamps"] = int(df["time"].duplicated().sum())
    full = pd.date_range(df["time"].min(), df["time"].max(), freq="h")
    v["missing_hours_in_range"] = int(len(full.difference(df["time"])))
    bad = (
        df[INDICATORS].isna().any(axis=1)
        | ~df["relative_humidity_2m"].between(0, 100)
        | (df["precipitation"] < 0)
    )
    v["rows_invalid"] = int(bad.sum())
    clean = df[~bad].copy()
    v["rows_valid"] = int(len(clean))
    v["period"] = [str(df["time"].min()), str(df["time"].max())]
    return clean, v


def daily(clean: pd.DataFrame) -> pd.DataFrame:
    g = clean.groupby(clean["time"].dt.date)
    d = pd.DataFrame({
        "avg_temperature": g["temperature_2m"].mean(),
        "min_temperature": g["temperature_2m"].min(),
        "max_temperature": g["temperature_2m"].max(),
        "avg_humidity": g["relative_humidity_2m"].mean(),
        "total_precipitation": g["precipitation"].sum(),
        "hourly_samples": g.size(),
    })
    d.index = pd.to_datetime(d.index)
    d.index.name = "forecast_date"
    return d.round(2)


def monthly(d: pd.DataFrame) -> pd.DataFrame:
    m = d.resample("MS").agg({
        "avg_temperature": "mean", "avg_humidity": "mean",
        "total_precipitation": "sum",
    })
    m["rainy_days_ge_1mm"] = (d["total_precipitation"] >= 1).resample("MS").sum()
    m.index = m.index.strftime("%Y-%m")
    m.index.name = "month"
    return m.round(2)


def trend_test(series: pd.Series, name: str) -> dict:
    """Regresi linear terhadap waktu (hari) + Mann-Kendall-style Kendall tau + cek asumsi residual."""
    y = series.to_numpy(dtype=float)
    x = np.arange(len(y), dtype=float)
    lr = stats.linregress(x, y)
    resid = y - (lr.intercept + lr.slope * x)
    # Asumsi: normalitas residual (Shapiro), autokorelasi lag-1 residual
    sh = stats.shapiro(resid)
    r1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1])
    # Durbin-Watson
    dw = float(np.sum(np.diff(resid) ** 2) / np.sum(resid ** 2))
    tau, p_tau = stats.kendalltau(x, y)
    # Selang kepercayaan 95% kemiringan (naif, mengabaikan autokorelasi)
    tcrit = stats.t.ppf(0.975, len(y) - 2)
    ci = (lr.slope - tcrit * lr.stderr, lr.slope + tcrit * lr.stderr)
    # Selang kepercayaan terkoreksi autokorelasi (n efektif = n(1-r1)/(1+r1))
    n_eff = max(3.0, len(y) * (1 - r1) / (1 + r1)) if r1 > 0 else float(len(y))
    se_adj = lr.stderr * np.sqrt(len(y) / n_eff)
    tcrit_adj = stats.t.ppf(0.975, max(1, n_eff - 2))
    ci_adj = (lr.slope - tcrit_adj * se_adj, lr.slope + tcrit_adj * se_adj)
    return {
        "indicator": name,
        "n_days": int(len(y)),
        "slope_per_day": float(lr.slope),
        "slope_per_30days": float(lr.slope * 30),
        "ci95_slope_per_30days_naive": [float(ci[0] * 30), float(ci[1] * 30)],
        "ci95_slope_per_30days_autocorr_adjusted": [float(ci_adj[0] * 30), float(ci_adj[1] * 30)],
        "p_value_ols": float(lr.pvalue),
        "r_squared": float(lr.rvalue ** 2),
        "kendall_tau": float(tau),
        "p_value_kendall": float(p_tau),
        "shapiro_residual_p": float(sh.pvalue),
        "residual_autocorr_lag1": r1,
        "durbin_watson": dw,
        "n_effective_autocorr": float(n_eff),
    }


def describe(d: pd.DataFrame) -> dict:
    out = {}
    for col in ["avg_temperature", "avg_humidity", "total_precipitation"]:
        s = d[col]
        out[col] = {
            "mean": s.mean(), "median": s.median(), "std": s.std(),
            "min": s.min(), "max": s.max(),
            "q25": s.quantile(.25), "q75": s.quantile(.75),
            "skew": float(stats.skew(s)),
        }
    out["total_precipitation"]["sum_year"] = float(d["total_precipitation"].sum())
    out["total_precipitation"]["rainy_days_ge_1mm"] = int((d["total_precipitation"] >= 1).sum())
    out["total_precipitation"]["dry_days_lt_1mm"] = int((d["total_precipitation"] < 1).sum())
    out["correlation_spearman"] = {
        "temp_vs_humidity": float(stats.spearmanr(d["avg_temperature"], d["avg_humidity"])[0]),
        "temp_vs_rain": float(stats.spearmanr(d["avg_temperature"], d["total_precipitation"])[0]),
        "humidity_vs_rain": float(stats.spearmanr(d["avg_humidity"], d["total_precipitation"])[0]),
    }
    return {k: ({a: float(b) for a, b in v.items()} if isinstance(v, dict) else v) for k, v in out.items()}


def plots(d: pd.DataFrame, m: pd.DataFrame, outdir: Path):
    fig, ax = plt.subplots(3, 1, figsize=(10, 9), sharex=True)
    specs = [("avg_temperature", "Suhu rata-rata harian (°C)", "#2769a1"),
             ("avg_humidity", "Kelembapan rata-rata harian (%)", "#168a76")]
    for a, (col, lab, color) in zip(ax[:2], specs):
        a.plot(d.index, d[col], color=color, lw=.8, alpha=.6, label="harian")
        a.plot(d.index, d[col].rolling(7, center=True).mean(), color="black", lw=1.6, label="rata-rata 7 hari")
        x = np.arange(len(d)); lr = stats.linregress(x, d[col])
        a.plot(d.index, lr.intercept + lr.slope * x, "--", color="red", lw=1.2, label="tren linear")
        a.set_ylabel(lab); a.legend(loc="upper left", fontsize=8)
    ax[2].bar(d.index, d["total_precipitation"], color="#df8d31", width=1)
    ax[2].set_ylabel("Curah hujan harian (mm)")
    fig.suptitle("Jakarta: data historis Open-Meteo, 16 Nov 2025 – 15 Nov 2026")
    fig.tight_layout(); fig.savefig(outdir / "tren_harian.png", dpi=130); plt.close(fig)

    fig, ax = plt.subplots(1, 3, figsize=(13, 3.8))
    ax[0].plot(m.index, m["avg_temperature"], marker="o", color="#2769a1"); ax[0].set_title("Suhu rata-rata bulanan (°C)")
    ax[1].plot(m.index, m["avg_humidity"], marker="o", color="#168a76"); ax[1].set_title("Kelembapan rata-rata bulanan (%)")
    ax[2].bar(m.index, m["total_precipitation"], color="#df8d31"); ax[2].set_title("Total hujan bulanan (mm)")
    for a in ax: a.tick_params(axis="x", rotation=60)
    fig.tight_layout(); fig.savefig(outdir / "bulanan.png", dpi=130); plt.close(fig)

    fig, ax = plt.subplots(1, 3, figsize=(12, 3.5))
    for a, col, color in zip(ax, ["avg_temperature", "avg_humidity", "total_precipitation"], ["#2769a1", "#168a76", "#df8d31"]):
        a.hist(d[col], bins=25, color=color); a.set_title(col)
    fig.tight_layout(); fig.savefig(outdir / "distribusi.png", dpi=130); plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(HERE / "data" / "openmeteo_jakarta_historical.json"))
    ap.add_argument("--outdir", default=str(HERE / "output"))
    a = ap.parse_args()
    outdir = Path(a.outdir); outdir.mkdir(parents=True, exist_ok=True)

    df = load(Path(a.input))
    clean, val = validate(df)
    d = daily(clean); m = monthly(d)

    # Konsistensi dengan agregasi harian bawaan Open-Meteo (cek silang pipeline)
    raw = json.loads(Path(a.input).read_text(encoding="utf-8"))
    ref = pd.DataFrame(raw["daily"]).set_index(pd.to_datetime(pd.DataFrame(raw["daily"])["time"]))
    val["crosscheck_vs_openmeteo_daily"] = {
        "max_abs_diff_temp_mean": float((d["avg_temperature"] - ref["temperature_2m_mean"]).abs().max()),
        "max_abs_diff_precip_sum": float((d["total_precipitation"] - ref["precipitation_sum"]).abs().max()),
        "max_abs_diff_humidity_mean": float((d["avg_humidity"] - ref["relative_humidity_2m_mean"]).abs().max()),
    }

    trends = [trend_test(d[c], c) for c in ["avg_temperature", "avg_humidity", "total_precipitation"]]
    # Perbandingan musim: hujan (Nov-Mar) vs kemarau (Jun-Sep) pada hujan harian
    wet = d[d.index.month.isin([12, 1, 2, 3])]["total_precipitation"]
    dry = d[d.index.month.isin([6, 7, 8, 9])]["total_precipitation"]
    mw = stats.mannwhitneyu(wet, dry, alternative="two-sided")
    season = {"wet_months": "Des-Mar", "dry_months": "Jun-Sep",
              "wet_median_mm": float(wet.median()), "dry_median_mm": float(dry.median()),
              "mannwhitney_U": float(mw.statistic), "p_value": float(mw.pvalue),
              "n_wet": int(len(wet)), "n_dry": int(len(dry))}

    summary = {"validation": val, "descriptive": describe(d), "trend": trends, "season_test": season}
    (outdir / "summary.json").write_text(json.dumps(summary, indent=2, default=float), encoding="utf-8")
    (outdir / "validation.json").write_text(json.dumps(val, indent=2), encoding="utf-8")
    d.to_csv(outdir / "daily.csv"); m.to_csv(outdir / "monthly.csv")
    pd.DataFrame(trends).to_csv(outdir / "trend.csv", index=False)
    plots(d, m, outdir)
    print(json.dumps(summary, indent=2, default=float))


if __name__ == "__main__":
    main()
