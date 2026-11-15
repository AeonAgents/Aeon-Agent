// A paired "phone" for dirty tests: keeps its key in device.json, signs every request like the real apps do.
import { generateKeyPairSync, randomBytes, sign, createPrivateKey } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = "C:/Users/<you>/project/Aeon";
const { canonicalRequest, PairingManager } = await import(pathToFileURL(join(repo, "src/node/server/device-auth.ts")).href);

export const BASE = process.env.AEON_BASE ?? "http://127.0.0.1:7421";
const FILE = join(here, process.env.AEON_DEVICE_FILE ?? "device.json");

function load() {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
}

export async function pair(code, name = "dirty-tester") {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const clientNonce = randomBytes(16).toString("base64");
  const proof = PairingManager.clientProof(PairingManager.normalize(code), name, pub, clientNonce);
  const res = await fetch(`${BASE}/v1/pair`, { method: "POST", body: JSON.stringify({ deviceName: name, publicKey: pub, clientNonce, proof }) });
  const body = await res.json();
  if (res.status === 201) writeFileSync(FILE, JSON.stringify({ id: body.deviceId, priv: privateKey.export({ type: "pkcs8", format: "pem" }) }));
  return { status: res.status, body };
}

export async function call(method, path, json, opts = {}) {
  const dev = opts.device ?? load();
  if (!dev) throw new Error("not paired: node drv.mjs pair CODE");
  const key = createPrivateKey(dev.priv);
  const body = json === undefined ? "" : typeof json === "string" ? json : JSON.stringify(json);
  const ts = String(opts.ts ?? Date.now());
  const nonce = opts.nonce ?? randomBytes(12).toString("hex");
  const sig = sign("sha256", Buffer.from(canonicalRequest(method, path, ts, nonce, body)), key).toString("base64");
  const headers = { "x-aeon-device": dev.id, "x-aeon-timestamp": ts, "x-aeon-nonce": nonce, "x-aeon-signature": sig };
  const t0 = Date.now();
  let res;
  for (let tries = 0; ; tries++) {
    try { res = await fetch(`${BASE}${path}`, { method, headers, ...(body ? { body } : {}), signal: opts.signal }); break; }
    catch (e) { if (tries >= 3 || opts.signal?.aborted) throw e; await new Promise((r) => setTimeout(r, 300)); } // a connection kept from before a server restart is dead
  }
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 300) }; }
  return { status: res.status, body: parsed, ms: Date.now() - t0 };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits until a task is no longer running on its own (done, failed, waiting for a person), up to maxMs. */
export async function waitTask(id, { maxMs = 240_000, until = (t) => !["PENDING", "RUNNING", "QUEUED", "CREATED", "PLANNING"].includes(t.status) } = {}) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < maxMs) {
    const r = await call("GET", `/v1/tasks/${id}`);
    last = r.body.task;
    if (last && until(last)) return last;
    await sleep(1500);
  }
  return last;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "pair") console.log(JSON.stringify(await pair(rest[0], rest[1])));
  else if (cmd === "call") {
    const [method, path, json] = rest;
    console.log(JSON.stringify(await call(method, path, json ? JSON.parse(json) : undefined), null, 2));
  } else console.log("usage: node drv.mjs pair CODE | call METHOD PATH [JSON]");
}

export function signedHeaders(method, path, body = "") {
  const dev = load();
  const key = createPrivateKey(dev.priv);
  const ts = String(Date.now());
  const nonce = randomBytes(12).toString("hex");
  const sig = sign("sha256", Buffer.from(canonicalRequest(method, path, ts, nonce, body)), key).toString("base64");
  return { "x-aeon-device": dev.id, "x-aeon-timestamp": ts, "x-aeon-nonce": nonce, "x-aeon-signature": sig };
}

/** Reads the audit events (SSE) for `ms` milliseconds and returns them as text. */
export async function events(ms = 2000, after = 0) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  let text = "";
  try {
    const path = `/v1/events?after=${after}`;
    const res = await fetch(`${BASE}${path}`, { headers: signedHeaders("GET", path), signal: ac.signal });
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
  } catch { /* aborted on purpose */ }
  clearTimeout(timer);
  return text;
}
