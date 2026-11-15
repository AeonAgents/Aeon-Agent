// The feed: the researcher reads Google News, the writer (EXAONE) writes, the reviewer (EXAONE) decides.
import { call } from "./drv.mjs";
const short = (s, n = 150) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
console.log("settings:", (await call("PUT", "/v1/feed/settings", { brief: "한국 IT와 인공지능 소식", dailyPosts: 3, dailyRuns: 12 })).status);
const t0 = Date.now();
const g = await call("POST", "/v1/feed/generate");
console.log(`generate: ${g.status} in ${Math.round((Date.now() - t0) / 1000)} s, report ${JSON.stringify(g.body.report ?? g.body).slice(0, 300)}`);
const f = await call("GET", "/v1/feed");
const posts = f.body.posts ?? [];
console.log(`feed: ${f.status}, ${posts.length} posts`);
for (const p of posts.slice(0, 4)) console.log(` - [${p.category}] ${short(p.title, 70)} | written=${p.written} | body ${String(p.body ?? "").length} chars | sources ${p.sources?.length} | ${short(p.reason, 60)}`);
const withBody = posts.filter((p) => p.written && String(p.body ?? "").length > 40);
const bad = posts.filter((p) => /<[a-z]+[ >]|&[a-z]+;/i.test(`${p.title} ${p.body}`));
console.log(`written posts: ${withBody.length}, posts with leftover markup: ${bad.length}`);
console.log("done");
