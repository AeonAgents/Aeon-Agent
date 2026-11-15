// Several real feed runs (real Google News, real EXAONE writer) on throwaway stores: how many posts pass the review, and why the others do not.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const base = "C:/Users/<you>/project/Aeon/src/";
const imp = (p) => import(pathToFileURL(base + p).href);
const { FeedPipeline } = await imp("node/feed-pipeline.ts");
const { GoogleNewsAdapter } = await imp("node/feed-sources.ts");
const { FeedStore } = await imp("node/feed-store.ts");
const { articleFetcher } = await imp("node/feed-images.ts");
const { exaoneProvider } = await imp("core/models/providers.ts");
const provider = exaoneProvider({ apiKey: process.env.EXAONE_API_KEY, reasoningEffort: process.env.EFFORT ?? "low" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function chat(system, user) {
  import("node:fs").then((fs) => fs.writeFileSync("<SCRATCH>" + "/writer-prompt.json", JSON.stringify({ system, user })));
  console.log("   writer prompt: system " + system.length + " chars, user " + user.length + " chars");
  for (let i = 0; i < 12; i++) {
    try { return (await provider.chat({ messages: [{ role: "system", content: system }, { role: "user", content: user }], maxTokens: 3000, temperature: 0.3 })).content; }
    catch (e) { console.log(`   chat error #${i}: kind=${e?.kind} retryable=${e?.retryable} ${String(e?.message ?? e).slice(0, 140)}`); if (!/busy|429|rate/i.test(String(e?.message ?? e)) && e?.kind !== "rate_limited") throw e; await sleep(4000); }
  }
  throw new Error("service stayed busy");
}
const sets = [["IT"], ["IT"]];
const totals = { made: 0, rejected: 0, runs: 0 };
for (const interests of sets) {
  const dir = mkdtempSync(join(tmpdir(), "feed-replay-"));
  const pipe = new FeedPipeline({ store: new FeedStore(join(dir, "f.json")), adapters: [new GoogleNewsAdapter({ articles: articleFetcher() })] });
  const t0 = Date.now();
  let report;
  try { report = await pipe.generate({ interests, chat, images: false, manual: true, online: true }); } catch (e) { report = { status: "error", message: String(e).slice(0, 120) }; }
  totals.runs++; totals.made += report.made ?? 0; totals.rejected += report.rejected?.length ?? 0;
  console.log(`${interests.join("+")}: ${Math.round((Date.now() - t0) / 1000)} s mode=${report.mode} status=${report.status} made=${report.made} candidates=${report.candidates} rejected=${JSON.stringify((report.rejected ?? []).map((r) => r.why))} msg=${report.message ?? ""}`);
  for (const p of pipe.store.read().posts.slice(0, 2)) console.log(`   + ${p.title} | ${String(p.body).slice(0, 110)}`);
}
console.log("totals:", JSON.stringify(totals));
