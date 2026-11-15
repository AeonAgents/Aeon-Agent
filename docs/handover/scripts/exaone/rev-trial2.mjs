// Gets one real writer reply for the saved candidates and runs the feed's own review on every post, printing why each is accepted or rejected.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const KEY = process.env.EXAONE_API_KEY;
const dir = process.argv[2];
const imp = (p) => import(pathToFileURL("C:/Users/<you>/project/Aeon/src/node/" + p).href);
const { reviewPost } = await imp("feed-pipeline.ts");
const { longestSharedRun } = await imp("feed-text.ts");
const { extractJsonObject } = await import(pathToFileURL("C:/Users/<you>/project/Aeon/src/core/untrusted.ts").href);
const { system, user } = JSON.parse(readFileSync(dir + "/writer-prompt.json", "utf8"));
const cands = JSON.parse(/<untrusted_data[^>]*>\s*(\[[\s\S]*\])\s*<\/untrusted_data>/.exec(user)[1]);
const candidates = new Map(cands.map((c) => [c.id, { id: "id-" + c.id, interest: c.interest, title: c.title, outlet: c.outlet, url: "https://news.example/" + c.id, publishedAt: Date.parse(c.published) }]));
const texts = new Map(cands.map((c) => [candidates.get(c.id).id, c.text ?? ""]));
console.log("candidates:", cands.map((c) => `${c.id}: title ${c.title.length} chars, text ${String(c.text ?? "").length} chars`).join(" | "));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let reply = JSON.parse(readFileSync(dir + "/rev-reply.json", "utf8")).reply;
for (let i = 0; i < 60 && !reply; i++) {
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 290000); const t0 = Date.now();
  try {
    const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoning_effort: "low", max_tokens: 3000, temperature: 0.3 }) });
    const t = await res.text();
    if (res.status === 200) { reply = JSON.parse(t).choices?.[0]?.message?.content ?? ""; console.log(`answered after ${Math.round((Date.now() - t0) / 1000)} s`); }
    else await sleep(2000);
  } catch (e) { console.log(`attempt ${i + 1}: ${e.name} after ${Math.round((Date.now() - t0) / 1000)} s`); }
  clearTimeout(timer);
}
if (!reply) { console.log("no answer"); process.exit(0); }
writeFileSync(dir + "/rev-reply.json", JSON.stringify({ reply }, null, 1));
const parsed = extractJsonObject(reply);
const now = Date.parse("2026-11-15T12:00:00Z");
const accepted = [];
for (const raw of parsed?.posts ?? []) {
  const r = reviewPost(raw, { candidates, texts, existing: [], accepted, now });
  const cite = (raw.sources ?? []).map((s) => candidates.get(s)).filter(Boolean);
  const runs = cite.map((c) => ({ vsTitle: longestSharedRun(String(raw.body ?? ""), c.title), vsText: longestSharedRun(String(raw.body ?? ""), texts.get(c.id) ?? "") }));
  if ("post" in r) accepted.push(r.post);
  console.log(`- ${"post" in r ? "ACCEPTED" : "REJECTED (" + r.why + ")"}: title "${raw.title}" | body ${String(raw.body).length} chars | longest shared run with the title/text: ${JSON.stringify(runs)}\n    body: ${String(raw.body).slice(0, 160)}`);
}
console.log("done");
