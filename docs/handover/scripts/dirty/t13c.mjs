import { call, sleep } from "./drv.mjs";
const short = (s, n = 150) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const s = await call("GET", "/v1/status");
console.log("status:", short(JSON.stringify(s.body), 400));
// make room: dismiss the three headline posts so the writer has something to do
const f0 = await call("GET", "/v1/feed");
for (const p of f0.body.posts ?? []) await call("POST", `/v1/feed/posts/${p.id}/react`, { reaction: "dismiss" });
for (let i = 1; i <= 3; i++) {
  const t0 = Date.now();
  const g = await call("POST", "/v1/feed/generate");
  const r = g.body.report ?? {};
  console.log(`try ${i}: ${g.status} ${Math.round((Date.now() - t0) / 1000)} s mode=${r.mode} status=${r.status} made=${r.made} msg="${r.message ?? ""}" rejected=${JSON.stringify(r.rejected ?? []).slice(0, 160)}`);
  if (r.mode === "written") {
    const f = await call("GET", "/v1/feed");
    for (const p of (f.body.posts ?? []).slice(0, 3)) console.log(` - written=${p.written} [${p.category}] ${short(p.title, 60)} | ${short(p.body, 160)}`);
    break;
  }
  await sleep(25000);
}
console.log("done");
