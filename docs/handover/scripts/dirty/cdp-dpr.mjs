// Opens the web app in a real browser (Chrome or Edge), waits for it to load for real, and saves screenshots.
// usage: node cdp-shot.mjs chrome|edge  WIDTHxHEIGHT  out.png  [waitSeconds]
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [kind, size, out, wait = "45"] = process.argv.slice(2);
const exe = kind === "edge" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [w, h] = size.split("x").map(Number);
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), `cdp-${kind}-`));
const proc = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(500); }
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: Number(process.env.DSF ?? 1), mobile: w < 600 });
await send("Page.enable");
const t0 = Date.now();
await send("Page.navigate", { url: "http://127.0.0.1:7421/" });
await sleep(Number(wait) * 1000);
const ua = (await send("Runtime.evaluate", { expression: "navigator.userAgent", returnByValue: true })).result.result.value;
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`${kind} ${size} after ${Math.round((Date.now() - t0) / 1000)}s -> ${out}\n${ua}`);
ws.close(); proc.kill();
