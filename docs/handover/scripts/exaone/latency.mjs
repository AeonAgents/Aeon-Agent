// How long the real service takes for the feed writer's actual prompt, call after call.
import { readFileSync } from "node:fs";
const KEY = process.env.EXAONE_API_KEY;
const { system, user } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const effort = process.argv[3] ?? "low";
const n = Number(process.argv[4] ?? 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
for (let i = 0; i < n; i++) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 110000);
  let status, extra = "";
  try {
    const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoning_effort: effort, max_tokens: 3000, temperature: 0.3 }) });
    status = res.status;
    const t = await res.text();
    if (res.status === 200) { const j = JSON.parse(t); extra = ` finish=${j.choices?.[0]?.finish_reason} out=${j.usage?.completion_tokens} reasoning=${j.usage?.completion_tokens_details?.reasoning_tokens ?? "?"}`; }
    else extra = " " + t.slice(0, 60);
  } catch (e) { status = "ABORT/" + (e.cause?.code ?? e.name); }
  clearTimeout(timer);
  rows.push(status);
  console.log(`#${i + 1} effort=${effort}: ${status} in ${Math.round((Date.now() - t0) / 100) / 10} s${extra}`);
  await sleep(1500);
}
console.log("statuses:", rows.join(" "));
