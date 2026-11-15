// Puts the agent and a Node.js runtime into one folder, which the desktop installer carries (decision D36), so that
// the desktop app can start its own agent and nobody has to install Node.js or use a terminal.
//
//   node tools/package-agent.mjs --out DIR [--node PATH] [--agent DIR]
//
// DIR gets:  project/   the compiled agent (the same build the Android app uses: dist-mobile, plain JavaScript)
//            runtime/   node.exe (node on Linux and macOS)
//
// Without --node the runtime is downloaded from nodejs.org, from the address pinned in tools/agent-runtime.json, and it is
// used only if its SHA-256 is the pinned one. --node PATH copies a runtime that is already on the machine instead (a
// developer's own, or a test's). --agent DIR copies an agent that was built already (tools/build-mobile.mjs DIR) instead of building one. --runtime-url / --runtime-sha256 replace the pinned address and hash (tests; plain http is
// accepted only for this computer's own address).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    node: { type: "string" },
    "runtime-url": { type: "string" },
    "runtime-sha256": { type: "string" },
    agent: { type: "string" },
  },
});
if (!values.out) {
  console.error("usage: node tools/package-agent.mjs --out DIR [--node PATH]");
  process.exit(2);
}
const out = values.out;
const runtimeName = process.platform === "win32" ? "node.exe" : "node";

/** Downloads [url] to [dest] and keeps the file only if its SHA-256 is [sha256]. */
async function download(url, sha256, dest) {
  const u = new URL(url);
  const loopback = u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) throw new Error(`the runtime must come over https: ${url}`);
  const res = await fetch(u);
  if (!res.ok || !res.body) throw new Error(`the runtime download failed: ${res.status} ${url}`);
  const part = `${dest}.part`;
  const hash = createHash("sha256");
  const sink = createWriteStream(part);
  const body = Readable.fromWeb(res.body);
  body.on("data", (chunk) => hash.update(chunk));
  await pipeline(body, sink);
  const got = hash.digest("hex");
  if (got !== sha256.toLowerCase()) {
    rmSync(part, { force: true });
    throw new Error(`the runtime is not the pinned one (SHA-256 ${got}, expected ${sha256}); it was not used`);
  }
  renameSync(part, dest);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "runtime"), { recursive: true });

// 1) the agent
// Built into this folder, not into dist-mobile: that one is rebuilt (emptied first) by other runs, the tests among them.
if (values.agent) cpSync(values.agent, join(out, "project"), { recursive: true });
else execFileSync(process.execPath, [join(root, "tools", "build-mobile.mjs"), join(out, "project")], { cwd: root, stdio: "inherit" });
if (!existsSync(join(out, "project", "node", "mobile-main.js"))) throw new Error("the agent build has no node/mobile-main.js");

// 2) the runtime
const target = join(out, "runtime", runtimeName);
if (values.node) {
  copyFileSync(values.node, target);
  console.log(`runtime: copied ${values.node}`);
} else {
  const pinned = JSON.parse(readFileSync(join(root, "tools", "agent-runtime.json"), "utf8")).platforms[`${process.platform}-${process.arch}`];
  const url = values["runtime-url"] ?? pinned?.url;
  const sha256 = values["runtime-sha256"] ?? pinned?.sha256;
  if (!url || !sha256) {
    console.error(`No Node.js runtime is pinned for ${process.platform}-${process.arch} (tools/agent-runtime.json). Pass --node PATH to use one that is on this machine.`);
    process.exit(1);
  }
  await download(url, sha256, target);
  console.log(`runtime: downloaded ${url}`);
}
if (process.platform !== "win32") chmodSync(target, 0o755);
console.log(`agent packaged in ${out} (runtime ${Math.round(statSync(target).size / 1_000_000)} MB)`);
