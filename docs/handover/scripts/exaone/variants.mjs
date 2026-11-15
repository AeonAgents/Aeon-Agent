// Same feed-writer prompt, different request shapes: which ones does the service answer when it accepts them?
import { readFileSync } from "node:fs";
const KEY = process.env.EXAONE_API_KEY;
const { system, user } = JSON.parse(readFileSync(process.argv[2] + "/writer-prompt.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = [
  ["max_tokens 400", { max_tokens: 400 }],
  ["max_tokens 3000, no temperature", { max_tokens: 3000, temperature: undefined }],
  ["no system role (merged into user)", { merge: true, max_tokens: 3000 }],
];
for (const [name, v] of variants) {
  let outcome = "never accepted";
  for (let i = 0; i < 25; i++) {
    const messages = v.merge ? [{ role: "user", content: system + "\n\n" + user }] : [{ role: "system", content: system }, { role: "user", content: user }];
    const body = { model: "k-exaone_v2.5", messages, reasoning_effort: "low", max_tokens: v.max_tokens ?? 3000, ...(v.temperature === undefined && !v.merge && name.includes("no temperature") ? {} : { temperature: 0.3 }) };
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 90000); const t0 = Date.now();
    try {
      const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) });
      const t = await res.text();
      if (res.status === 429) { clearTimeout(timer); await sleep(2000); continue; }
      if (res.status === 200) { const j = JSON.parse(t); outcome = `answered in ${Math.round((Date.now() - t0) / 100) / 10} s, finish=${j.choices?.[0]?.finish_reason}, completion_tokens=${j.usage?.completion_tokens}`; }
      else outcome = `status ${res.status}`;
      clearTimeout(timer); break;
    } catch (e) { outcome = `accepted but ${e.name} after ${Math.round((Date.now() - t0) / 1000)} s`; clearTimeout(timer); break; }
  }
  console.log(`${name}: ${outcome}`);
}
console.log("done");
