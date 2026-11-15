// Streams the feed writer's prompt: when does the first token arrive, how fast do tokens come, how long does the whole answer take?
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.EXAONE_API_KEY;
const dir = process.argv[2];
const { system, user } = JSON.parse(readFileSync(dir + "/writer-prompt.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 30; i++) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 280000);
  try {
    const res = await fetch("https://api.exaone.ai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", stream: true, stream_options: { include_usage: true }, messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoning_effort: "low", max_tokens: 3000, temperature: 0.3 }) });
    if (res.status !== 200) { console.log(`try ${i + 1}: ${res.status}`); clearTimeout(timer); await sleep(2500); continue; }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let first = null, chunks = 0, content = "", reasoning = "", buf = "", usage = null;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl; while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data:") || line.includes("[DONE]")) continue;
        try { const j = JSON.parse(line.slice(5)); const d = j.choices?.[0]?.delta; if (d?.content) content += d.content; if (d?.reasoning_content) reasoning += d.reasoning_content; if (j.usage) usage = j.usage; if (first === null && (d?.content || d?.reasoning_content)) first = Date.now() - t0; chunks++; } catch {}
      }
    }
    const total = Date.now() - t0;
    console.log(`try ${i + 1}: 200 first token after ${first} ms, whole answer ${Math.round(total / 100) / 10} s, ${chunks} chunks, answer ${content.length} chars, reasoning ${reasoning.length} chars, usage ${JSON.stringify(usage)}`);
    writeFileSync(dir + "/writer-stream-reply.json", JSON.stringify({ content, reasoning: reasoning.slice(0, 500) }, null, 1));
    break;
  } catch (e) { console.log(`try ${i + 1}: ${e.name} after ${Math.round((Date.now() - t0) / 1000)} s`); }
  clearTimeout(timer);
  await sleep(2500);
}
console.log("done");
