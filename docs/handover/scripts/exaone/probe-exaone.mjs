// What the real EXAONE service does with each feature Aeon could use. The key comes from the environment and is never printed.
const KEY = process.env.EXAONE_API_KEY;
if (!KEY) throw new Error("EXAONE_API_KEY missing (run with node --env-file=.env)");
const BASE = "https://api.exaone.ai/v1";
const MODEL = "k-exaone_v2.5";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, { tries = 8, raw = false } = {}) {
  let busy = 0;
  for (let i = 0; i < tries; i++) {
    let res; try { res = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) }); } catch (e) { return { status: "NETWORK", json: { error: String(e.cause?.code ?? e.message) }, busy, res: { status: "NETWORK", text: async () => "" } }; }
    if (res.status === 429) { busy++; await res.text(); await sleep(2500 + i * 1000); continue; }
    if (raw) return { res, busy };
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, json, busy };
  }
  return { status: 429, json: { note: "still busy after retries" }, busy };
}
const short = (s, n = 140) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const msg = (r) => r.json?.choices?.[0]?.message;
const out = [];
const log = (name, ok, detail) => { out.push({ name, ok, detail }); console.log(`${ok === true ? "OK  " : ok === false ? "FAIL" : "INFO"} ${name}: ${detail}`); };

if (process.env.FROM === "6") {} else {
// P1: a plain Korean answer
{
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: "한 문장으로 인사해 주세요." }], reasoning_effort: "low", max_tokens: 400 });
  log("P1 plain Korean answer", r.status === 200 && !!msg(r)?.content, `status ${r.status}, busy retries ${r.busy}, answer "${short(msg(r)?.content, 80)}", usage ${JSON.stringify(r.json?.usage ?? {})}`);
  log("P1b reply fields", null, `message keys: ${Object.keys(msg(r) ?? {}).join(",")}, finish_reason ${r.json?.choices?.[0]?.finish_reason}`);
}
// P2: reasoning levels
for (const eff of ["low", "high", "max", "medium", "none"]) {
  await sleep(1100);
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: "7 곱하기 8은?" }], reasoning_effort: eff, max_tokens: 1500 });
  log(`P2 reasoning_effort=${eff}`, r.status === 200 ? true : null, `status ${r.status}${r.status !== 200 ? " " + short(JSON.stringify(r.json), 120) : `, answer "${short(msg(r)?.content, 40)}", completion tokens ${r.json?.usage?.completion_tokens}`}`);
}
// P3: streaming
{
  await sleep(1100);
  const { res } = await post("/chat/completions", { model: MODEL, stream: true, stream_options: { include_usage: true }, messages: [{ role: "user", content: "하나, 둘, 셋 이라고만 답해 주세요." }], reasoning_effort: "low", max_tokens: 300 }, { raw: true });
  if (res.status !== 200) log("P3 streaming", false, `status ${res.status} ${short(await res.text(), 120)}`);
  else {
    const text = await res.text();
    const events = text.split("\n").filter((l) => l.startsWith("data:"));
    log("P3 streaming (SSE)", events.length > 1, `${events.length} data lines, ends with ${short(events.at(-1), 30)}, content-type ${res.headers.get("content-type")}`);
  }
}
// P4: native tool calling
{
  await sleep(1100);
  const tools = [{ type: "function", function: { name: "get_weather", description: "도시의 현재 날씨를 알려줍니다", parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } } }];
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: "서울 날씨 알려줘. 반드시 도구를 사용해." }], tools, tool_choice: "auto", reasoning_effort: "low", max_tokens: 800 });
  const calls = msg(r)?.tool_calls;
  log("P4 native tool calling", r.status === 200 ? (Array.isArray(calls) && calls.length > 0) : false, r.status === 200 ? `tool_calls ${JSON.stringify(calls ?? null)?.slice(0, 160)}; text "${short(msg(r)?.content, 60)}"` : `status ${r.status} ${short(JSON.stringify(r.json), 160)}`);
}
// P5: structured output
for (const [name, rf] of [["json_object", { type: "json_object" }], ["json_schema", { type: "json_schema", json_schema: { name: "greet", schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } }]]) {
  await sleep(1100);
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: 'JSON으로만 답하세요: {"text": "안녕"} 형태로 인사.' }], response_format: rf, reasoning_effort: "low", max_tokens: 600 });
  let parsed = false; try { JSON.parse(msg(r)?.content ?? ""); parsed = true; } catch {}
  log(`P5 response_format ${name}`, r.status === 200 ? parsed : false, r.status === 200 ? `reply parses as JSON: ${parsed}, "${short(msg(r)?.content, 70)}"` : `status ${r.status} ${short(JSON.stringify(r.json), 160)}`);
}
}
// P6: a long Korean prompt (about 40k characters)
{
  await sleep(1100);
  const filler = "이 문장은 긴 입력을 시험하기 위한 반복 문장입니다. ".repeat(900);
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "system", content: "당신은 짧게 답하는 도우미입니다." }, { role: "user", content: filler + "\n\n위 글은 같은 문장의 반복입니다. 이 문장이 몇 번 나오는지 대충 말해 주세요." }], reasoning_effort: "low", max_tokens: 800 });
  log("P6 long input (~40k characters)", r.status === 200, `status ${r.status}, prompt tokens ${r.json?.usage?.prompt_tokens}, answer "${short(msg(r)?.content, 60)}"`);
}
// P7: out-of-range and odd parameters: the error shape the app must turn into plain words
for (const [name, body] of [["temperature 5", { temperature: 5 }], ["max_tokens 0", { max_tokens: 0 }], ["empty messages", { messages: [] }], ["unknown model", { model: "nope-1" }]]) {
  await sleep(1100);
  const r = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: "안녕" }], reasoning_effort: "low", max_tokens: 100, ...body });
  log(`P7 ${name}`, null, `status ${r.status} ${short(JSON.stringify(r.json), 150)}`);
}
// P8: eight at once, to see how often the service says it is busy
{
  await sleep(1500);
  const results = await Promise.all(Array.from({ length: 8 }, async () => {
    const { res } = await post("/chat/completions", { model: MODEL, messages: [{ role: "user", content: "숫자 1만 답해요." }], reasoning_effort: "low", max_tokens: 100 }, { raw: true, tries: 1 });
    const t = await res.text();
    return res.status + (res.status === 429 ? ":" + short(t, 40) : "");
  }));
  log("P8 eight calls at once", null, results.join(" | "));
}
// P9: the model list
{
  await sleep(1100);
  const res = await fetch(BASE + "/models", { headers: { authorization: `Bearer ${KEY}` } });
  const t = await res.text();
  log("P9 GET /models", null, `status ${res.status} ${short(t, 160)}`);
}
// P10: no key and a bad key
{
  const a = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "x" }] }) });
  log("P10a no key", null, `status ${a.status} ${short(await a.text(), 120)}`);
  const b = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer sk-" + "x".repeat(40) }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "x" }] }) });
  log("P10b well-formed but wrong key", null, `status ${b.status} ${short(await b.text(), 120)}`);
}
