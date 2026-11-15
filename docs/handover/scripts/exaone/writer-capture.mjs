// Gets one real writer reply for the saved feed prompt and saves it, so the review rule can be tried against what the real model writes.
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.EXAONE_API_KEY;
const dir = process.argv[2];
const effort = process.argv[3] ?? "low";
const { system, user } = JSON.parse(readFileSync(dir + "/writer-prompt.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 100000);
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoning_effort: effort, max_tokens: 3000, temperature: 0.3 }) });
    const text = await res.text();
    if (res.status === 200) {
      const j = JSON.parse(text);
      const content = j.choices?.[0]?.message?.content ?? "";
      writeFileSync(`${dir}/writer-reply-${effort}-${Date.now()}.json`, JSON.stringify({ content, usage: j.usage, finish: j.choices?.[0]?.finish_reason }, null, 1));
      console.log(`try ${i + 1}: 200 in ${Math.round((Date.now() - t0) / 100) / 10} s, ${content.length} chars, finish=${j.choices?.[0]?.finish_reason}`);
      break;
    }
    console.log(`try ${i + 1}: ${res.status}`);
  } catch (e) { console.log(`try ${i + 1}: ${e.name} after ${Math.round((Date.now() - t0) / 1000)} s`); }
  clearTimeout(timer);
  await sleep(3000);
}
console.log("done");
