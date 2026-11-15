// A recording, failure-injecting proxy in front of the real EXAONE API. The mode is read from chaos.mode on every request.
import { createServer } from "node:http";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const key = readFileSync("C:/Users/<you>/project/Aeon/.env", "utf8").match(/EXAONE_API_KEY=(.*)/)[1].trim().replace(/^["']|["']$/g, "");
const log = (s) => appendFileSync(join(here, "chaos.log"), `${new Date().toISOString().slice(11, 23)} ${s}\n`);
const mode = () => { try { return readFileSync(join(here, "chaos.mode"), "utf8").trim() || "pass"; } catch { return "pass"; } };
let n = 0;
createServer(async (req, res) => {
  const id = ++n;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const m = mode();
  let msgCount = "?";
  try { msgCount = JSON.parse(body.toString()).messages.length; } catch {}
  log(`#${id} ${req.method} ${req.url} bytes=${body.length} messages=${msgCount} mode=${m}`);
  const reply = (status, text, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(text); log(`#${id} -> ${status} ${text.slice(0, 120).replace(/\s+/g, " ")}`); };
  if (m === "429") return reply(429, '{"error":{"message":"rate limit"}}', { "retry-after": "3" });
  if (m === "dayquota") return reply(429, '{"error":{"message":"daily limit reached"}}', { "x-day-rate-limit-remaining": "0" });
  if (m === "429plain") return reply(429, '{"error":{"message":"rate limit"}}');
  if (m === "500") return reply(500, '{"error":{"message":"internal error"}}');
  if (m === "503") return reply(503, "<html>Service Unavailable</html>");
  if (m === "401") return reply(401, '{"error":{"message":"invalid api key"}}');
  if (m === "garbage") return reply(200, "this is not json {{{");
  if (m === "empty") return reply(200, JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "" } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }));
  if (m === "notjsonreply") return reply(200, JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "죄송하지만 JSON이 아닌 평범한 문장으로 대답할게요." } }], usage: { prompt_tokens: 5, completion_tokens: 9 } }));
  if (m === "reset") { log(`#${id} -> socket destroyed`); req.socket.destroy(); return; }
  if (m === "hang") { log(`#${id} -> hanging`); return; }
  if (m.startsWith("slow:")) await new Promise((r) => setTimeout(r, Number(m.slice(5))));
  try {
    const up = await fetch("https://api.exaone.ai" + req.url.replace(/^\/v1/, "/v1"), { method: req.method, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: req.method === "POST" ? body : undefined });
    const text = await up.text();
    const rl = ["x-second-rate-limit-remaining", "x-minute-rate-limit-remaining", "x-day-rate-limit-remaining", "retry-after"].map((h) => `${h.replace("-rate-limit-remaining", "")}=${up.headers.get(h)}`).join(" ");
    log(`#${id} upstream ${up.status} ${rl}`);
    const out = m === "truncated" ? text.slice(0, Math.floor(text.length / 2)) : text;
    res.writeHead(up.status, { "content-type": up.headers.get("content-type") ?? "application/json" });
    res.end(out);
    log(`#${id} -> ${up.status} ${out.slice(0, 160).replace(/\s+/g, " ")}`);
  } catch (e) { log(`#${id} upstream error ${e.message}`); reply(502, '{"error":"proxy upstream failed"}'); }
}).listen(7470, "127.0.0.1", () => log("chaos proxy listening on 7470"));
