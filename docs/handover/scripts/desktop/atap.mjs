// usage: node atap.mjs list | tap "text" | shot name | text "abc" | key CODE
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
const ADB = "C:/Android/platform-tools/adb.exe";
const S = "<SCRATCH>";
const adb = (...a) => execFileSync(ADB, a, { encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" }, maxBuffer: 1 << 26 });
const nodes = () => {
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  const xml = adb("exec-out", "cat", "/sdcard/ui.xml");
  const out = [];
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) out.push({ t: m[1] || m[2], x: (+m[3] + +m[5]) / 2, y: (+m[4] + +m[6]) / 2 });
  return out.filter((n) => n.t);
};
const [cmd, arg] = process.argv.slice(2);
if (cmd === "list") for (const n of nodes()) console.log(`${n.t.replace(/\s+/g, " ").slice(0, 70)} @ ${n.x},${n.y}`);
if (cmd === "tap") { const n = nodes().find((n) => n.t.includes(arg)); if (!n) { console.log("not found:", arg); process.exit(1); } adb("shell", "input", "tap", String(Math.round(n.x)), String(Math.round(n.y))); console.log("tapped", n.t.slice(0, 40)); }
if (cmd === "xy") { const [x, y] = arg.split(","); adb("shell", "input", "tap", x, y); }
if (cmd === "text") adb("shell", "input", "text", arg);
if (cmd === "key") adb("shell", "input", "keyevent", arg);
if (cmd === "shot") { adb("shell", "screencap", "-p", "/sdcard/s.png"); adb("pull", "/sdcard/s.png", `${S}/${arg}.png`); console.log("saved", arg); }
