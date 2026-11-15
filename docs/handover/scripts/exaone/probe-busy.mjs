// How often the real service says "busy" for each reasoning level, one call at a time with a pause, and then eight at once.
const KEY = process.env.EXAONE_API_KEY;
const BASE = "https://api.exaone.ai/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function once(effort, content = "숫자 1만 답해요.") {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "user", content }], reasoning_effort: effort, max_tokens: 400 }) });
    const text = await res.text();
    return { status: res.status, ms: Date.now() - t0, note: res.status === 429 ? text.slice(0, 60) : "" };
  } catch (e) { return { status: "ERR " + (e.cause?.code ?? e.message), ms: Date.now() - t0 }; }
}
const rounds = Number(process.env.ROUNDS ?? 8);
for (const effort of ["low", "medium", "high"]) {
  const got = [];
  for (let i = 0; i < rounds; i++) { got.push((await once(effort)).status); await sleep(1500); }
  console.log(`${effort}: ${got.join(" ")}  -> ok ${got.filter((s) => s === 200).length}/${rounds}`);
}
// interleaved, so the time of day cannot explain a difference
{
  const seq = [];
  for (let i = 0; i < rounds; i++) for (const effort of ["low", "high"]) { seq.push(`${effort[0]}${(await once(effort)).status}`); await sleep(1500); }
  console.log("interleaved low/high: " + seq.join(" "));
}
// eight at once
{
  const r = await Promise.all(Array.from({ length: 8 }, () => once("low")));
  console.log("eight at once: " + r.map((x) => x.status).join(" "));
}
// the model list, no key, a wrong key
{
  const m = await fetch(BASE + "/models", { headers: { authorization: `Bearer ${KEY}` } });
  console.log("GET /models:", m.status, (await m.text()).slice(0, 150).replace(/\s+/g, " "));
  const a = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "user", content: "x" }] }) });
  console.log("no key:", a.status, (await a.text()).slice(0, 120));
  const b = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer sk-" + "x".repeat(40) }, body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "user", content: "x" }] }) });
  console.log("wrong but well-formed key:", b.status, (await b.text()).slice(0, 120));
}
