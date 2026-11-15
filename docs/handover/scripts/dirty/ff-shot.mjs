// Opens the web app in Firefox (headless, WebDriver BiDi), waits for it to load for real, and saves a screenshot.
// usage: node ff-shot.mjs WIDTHxHEIGHT out.png [waitSeconds] [js-to-run-after-load]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [size, out, wait = "60", script] = process.argv.slice(2);
const [w, h] = size.split("x").map(Number);
const exe = "<SCRATCH>/firefox-test/firefox.exe";
const port = 9600 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), "ff-prof-"));
const proc = spawn(exe, ["--headless", "--no-remote", "-profile", profile, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) {
  try { ws = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; } catch { ws = null; await sleep(500); }
}
if (!ws) { console.log("could not reach Firefox's BiDi endpoint"); proc.kill(); process.exit(1); }
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const must = (r) => { if (r.error) throw new Error(`${r.error}: ${r.message}`); return r.result; };
must(await send("session.new", { capabilities: {} }));
const tree = must(await send("browsingContext.getTree", {}));
const ctx = tree.contexts[0].context;
must(await send("browsingContext.setViewport", { context: ctx, viewport: { width: w, height: h } }));
const t0 = Date.now();
must(await send("browsingContext.navigate", { context: ctx, url: "http://127.0.0.1:7421/", wait: "complete" }));
await sleep(Number(wait) * 1000);
const ua = must(await send("script.evaluate", { expression: "navigator.userAgent + ' | wasm gc: ' + (typeof WebAssembly !== 'undefined')", target: { context: ctx }, awaitPromise: false })).result?.value;
if (script) { try { console.log("script:", JSON.stringify(must(await send("script.evaluate", { expression: script, target: { context: ctx }, awaitPromise: false })).result?.value)); } catch (e) { console.log("script failed:", e.message); } }
for (const c of (process.env.CLICKS || "").split(";").filter(Boolean)) {
  const [x, y] = c.split(",").map(Number);
  must(await send("input.performActions", { context: ctx, actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerMove", x, y }, { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 }] }] }));
  await sleep(4000);
}
const shot = must(await send("browsingContext.captureScreenshot", { context: ctx }));
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`firefox ${size} after ${Math.round((Date.now() - t0) / 1000)}s -> ${out}\n${ua}`);
ws.close(); proc.kill();
