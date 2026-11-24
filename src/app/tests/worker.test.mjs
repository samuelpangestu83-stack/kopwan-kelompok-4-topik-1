// Tes tanpa dependensi: node src/app/tests/worker.test.mjs
// Menjalankan src/app/worker.js ASLI dengan D1, R2, dan fetch tiruan (mock).
// Mencakup: (1) kecocokan agregasi dengan src/analysis/output/daily.csv,
// (2) API down, (3) data kosong, (4) format salah, (5) semua nilai tidak valid,
// (6) sebagian nilai tidak valid dilewati, (7) endpoint admin tanpa/dengan token salah.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "worker.js"), "utf8");
const tmp = path.join(os.tmpdir(), "worker_under_test.mjs");
fs.writeFileSync(tmp, src);
const worker = (await import(pathToFileURL(tmp).href)).default;

const hist = JSON.parse(fs.readFileSync(path.join(here, "../../analysis/data/openmeteo_jakarta_historical.json"), "utf8"));
const csv = fs.readFileSync(path.join(here, "../../analysis/output/daily.csv"), "utf8").trim().split("\n").slice(1)
  .map(l => l.split(",")).map(c => ({ date: c[0], t: +c[1], h: +c[4], r: +c[5], n: +c[6] }));

function makeEnv() {
  const log = { runs: [], daily: [], raw: [] };
  const stmt = sql => ({
    bind: (...a) => ({
      run: async () => {
        if (/INSERT INTO pipeline_runs/.test(sql)) log.runs.push({ run_id: a[0], status: a[2] });
        else if (/status = 'success'/.test(sql)) Object.assign(log.runs.find(r => r.run_id === a[2]), { status: "success", row_count: a[1] });
        else if (/status = 'failed'/.test(sql)) Object.assign(log.runs.find(r => r.run_id === a[2]), { status: "failed", error: a[1] });
        return {};
      },
      _sql: sql, _a: a,
    }),
  });
  return {
    log,
    ADMIN_TOKEN: "test-token",
    DB: {
      prepare: stmt,
      batch: async list => { for (const s of list) { const a = s._a; log.daily.push({ date: a[1], t: a[2], h: a[3], r: a[4], n: a[5] }); } },
    },
    RAW: { put: async (k, v) => { log.raw.push(k); } },
  };
}
async function runScheduled(env) {
  let p; await worker.scheduled({}, env, { waitUntil: x => { p = x; } });
  try { await p; return null; } catch (e) { return e; }
}
const mockFetch = (body, { ok = true, status = 200 } = {}) => {
  globalThis.fetch = async () => ({ ok, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
};

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
const origError = console.error; console.error = () => {}; const origLog = console.log;

// 1. Agregasi == analysis.py
{
  const env = makeEnv(); mockFetch(hist);
  const err = await runScheduled(env);
  check("1a pipeline sukses pada 8760 baris historis", err === null && env.log.runs[0].status === "success");
  check("1b jumlah hari = 365", env.log.daily.length === 365, `(${env.log.daily.length})`);
  let maxT = 0, maxH = 0, maxR = 0;
  for (const d of env.log.daily) {
    const c = csv.find(x => x.date === d.date);
    maxT = Math.max(maxT, Math.abs(d.t - c.t)); maxH = Math.max(maxH, Math.abs(d.h - c.h)); maxR = Math.max(maxR, Math.abs(d.r - c.r));
  }
  // daily.csv dibulatkan 2 desimal -> galat pembulatan maksimum 0.005; toleransi 0.0051 menyerap galat floating point
  check("1c selisih maks suhu <= 0.0051 °C (pembulatan CSV)", maxT <= 0.0051, `(${maxT.toFixed(4)})`);
  check("1d selisih maks kelembapan <= 0.0051 (pembulatan CSV)", maxH <= 0.0051, `(${maxH.toFixed(4)})`);
  check("1e selisih maks hujan <= 0.05 mm (pembulatan float)", maxR <= 0.05, `(${maxR.toFixed(4)})`);
  check("1f data mentah disimpan ke R2 (raw/<run_id>.json)", /^raw\/.+\.json$/.test(env.log.raw[0] || ""));
}
// 2. API down
{
  const env = makeEnv(); mockFetch("boom", { ok: false, status: 503 });
  const err = await runScheduled(env);
  check("2 API down -> status failed + pesan HTTP 503", !!err && env.log.runs[0].status === "failed" && /503/.test(env.log.runs[0].error));
}
// 3. Data kosong
{
  const env = makeEnv(); mockFetch({ hourly: { time: [], temperature_2m: [], relative_humidity_2m: [], precipitation: [] } });
  const err = await runScheduled(env);
  check("3 data kosong -> failed, tidak ada baris daily", !!err && env.log.runs[0].status === "failed" && env.log.daily.length === 0);
}
// 4. Format salah (bukan JSON / field hilang / panjang array beda)
{
  let env = makeEnv(); mockFetch("<html>bukan json</html>");
  let err = await runScheduled(env);
  check("4a bukan JSON -> failed", !!err && env.log.runs[0].status === "failed");
  env = makeEnv(); mockFetch({ foo: 1 });
  err = await runScheduled(env);
  check("4b field hourly hilang -> failed", !!err && env.log.runs[0].status === "failed");
  env = makeEnv(); mockFetch({ hourly: { time: ["2026-01-01T00:00", "2026-01-01T01:00"], temperature_2m: [1], relative_humidity_2m: [1, 2], precipitation: [0, 0] } });
  err = await runScheduled(env);
  check("4c panjang array tidak sama -> failed", !!err && env.log.runs[0].status === "failed");
}
// 5. Semua tidak valid
{
  const env = makeEnv();
  mockFetch({ hourly: { time: ["2026-01-01T00:00", "2026-01-01T01:00"], temperature_2m: [null, 30], relative_humidity_2m: [50, 150], precipitation: [0, -1] } });
  const err = await runScheduled(env);
  check("5 semua nilai tidak valid -> failed", !!err && env.log.runs[0].status === "failed" && /valid/i.test(env.log.runs[0].error));
}
// 6. Sebagian tidak valid dilewati
{
  const env = makeEnv();
  mockFetch({ hourly: { time: ["2026-01-01T00:00", "2026-01-01T01:00", "2026-01-01T02:00"], temperature_2m: [30, null, 32], relative_humidity_2m: [60, 70, 101], precipitation: [1, 1, 1] } });
  const err = await runScheduled(env);
  check("6 sebagian tidak valid: sukses dan hanya 1 sampel dipakai", err === null && env.log.daily.length === 1 && env.log.daily[0].n === 1, JSON.stringify(env.log.daily[0] || {}));
}
// 7. Endpoint admin
{
  const env = makeEnv(); mockFetch(hist);
  const mk = (h) => new Request("https://x.test/admin/run", { method: "POST", headers: h });
  let r = await worker.fetch(mk({}), env);
  check("7a /admin/run tanpa token -> 401", r.status === 401);
  r = await worker.fetch(mk({ "x-admin-token": "salah" }), env);
  check("7b token salah -> 401", r.status === 401);
  r = await worker.fetch(mk({ "x-admin-token": "test-token" }), env);
  check("7c token benar -> 200", r.status === 200);
  r = await worker.fetch(mk({ "x-admin-token": "x" }), { ...env, ADMIN_TOKEN: undefined });
  check("7d ADMIN_TOKEN belum diset -> 503", r.status === 503);
  r = await worker.fetch(new Request("https://x.test/health"), env);
  check("7e /health -> 200", r.status === 200);
}
console.error = origError;
console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
