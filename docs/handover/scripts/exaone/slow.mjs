// How long does an accepted feed-writer call really take if it is given up to 10 minutes?
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.EXAONE_API_KEY;
const dir = process.argv[2];
const { system, user } = JSON.parse(readFileSync(dir + "/writer-prompt.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let answered = 0;
for (let round = 0; round < 3 && answered < 3; round++) {
  for (let i = 0; i < 40; i++) {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 600000); const t0 = Date.now();
    try {
      const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoning_effort: "low", max_tokens: 3000, temperature: 0.3 }) });
      const t = await res.text();
      if (res.status === 429) { clearTimeout(timer); await sleep(2000); continue; }
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      if (res.status === 200) { const j = JSON.parse(t); answered++; writeFileSync(`${dir}/writer-slow-${answered}.json`, JSON.stringify({ content: j.choices?.[0]?.message?.content, usage: j.usage, finish: j.choices?.[0]?.finish_reason }, null, 1)); console.log(`accepted call ${answered}: answered after ${secs} s, finish=${j.choices?.[0]?.finish_reason}, completion_tokens=${j.usage?.completion_tokens} (${Math.round(j.usage?.completion_tokens / secs * 10) / 10} tokens/s)`); }
      else console.log(`accepted call: status ${res.status} after ${secs} s`);
      clearTimeout(timer); break;
    } catch (e) { console.log(`accepted call: ${e.name} after ${Math.round((Date.now() - t0) / 1000)} s`); clearTimeout(timer); break; }
  }
}
console.log("done");
