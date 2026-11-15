import { call, sleep } from "./drv.mjs";
const short = (s, n = 150) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
console.log("settings:", (await call("PUT", "/v1/feed/settings", { dailyPosts: 8, dailyRuns: 12 })).status);
for (let i = 1; i <= 4; i++) {
  const t0 = Date.now();
  const g = await call("POST", "/v1/feed/generate");
  const r = g.body.report ?? {};
  console.log(`try ${i}: ${g.status} ${Math.round((Date.now() - t0) / 1000)} s mode=${r.mode} status=${r.status} made=${r.made} msg="${r.message ?? ""}" rejected=${JSON.stringify(r.rejected ?? []).slice(0, 200)}`);
  if (r.mode === "written" && r.made > 0) {
    for (const p of ((await call("GET", "/v1/feed")).body.posts ?? []).slice(0, 4)) console.log(` - written=${p.written} [${p.category}] ${short(p.title, 60)} | ${short(p.body, 170)}`);
    break;
  }
  await sleep(25000);
}
console.log("done");
