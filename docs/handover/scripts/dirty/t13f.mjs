import { call, sleep } from "./drv.mjs";
const short = (s, n = 170) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
for (let i = 1; i <= 12; i++) {
  const t0 = Date.now();
  const g = await call("POST", "/v1/feed/generate");
  const r = g.body.report ?? {};
  console.log(`try ${i}: ${g.status} ${Math.round((Date.now() - t0) / 1000)} s mode=${r.mode} status=${r.status} made=${r.made} msg="${r.message ?? ""}" rejected=${JSON.stringify(r.rejected ?? []).slice(0, 200)}`);
  if (r.status !== "skipped" || !/방금/.test(r.message ?? "")) {
    for (const p of ((await call("GET", "/v1/feed")).body.posts ?? []).slice(0, 8)) console.log(` - written=${p.written} [${p.category}] ${short(p.title, 60)} | body ${String(p.body ?? "").length} chars | ${short(p.body, 130)}`);
    break;
  }
  await sleep(40000);
}
console.log("done");
