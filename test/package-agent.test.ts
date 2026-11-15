import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

// tools/package-agent.mjs fills the folder that the desktop installer carries: the agent and a Node.js runtime, so that the
// desktop app can start its own agent (decision D36). What matters here: the folder works on its own, and a runtime whose
// hash is not the pinned one is never used.

const root = join(import.meta.dirname, "..");
const script = join(root, "tools", "package-agent.mjs");
const runtimeName = process.platform === "win32" ? "node.exe" : "node";
const work = mkdtempSync(join(tmpdir(), "aeon-package-"));

// Asynchronous on purpose: a test that serves the runtime from this same process must not block its own event loop.
const run = (args: string[]): Promise<{ status: number | null; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("close", (status) => resolve({ status, stderr }));
  });

before(() => {
  // one full build; the other runs reuse it
  execFileSync(process.execPath, [script, "--out", join(work, "full"), "--node", process.execPath], { cwd: root, stdio: "ignore" });
});
after(() => rmSync(work, { recursive: true, force: true }));

const stop = (child: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill();
  });

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

/** Serves [body] on this computer's loopback and returns its address. */
const serve = (body: Buffer): Promise<{ url: string; server: Server }> =>
  new Promise((resolve) => {
    const server = createHttpServer((_req, res) => res.end(body));
    server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}/node`, server }));
  });

test("the folder holds the agent and the runtime, and the runtime starts the agent on its own", async () => {
  const dir = join(work, "full");
  assert.ok(existsSync(join(dir, "project", "node", "mobile-main.js")), "the compiled agent");
  assert.ok(existsSync(join(dir, "project", "package.json")), "marks the agent as ES modules");
  assert.equal(statSync(join(dir, "runtime", runtimeName)).size, statSync(process.execPath).size, "the runtime is the file that was asked for");

  const cfg = join(dir, "cfg");
  const ws = join(dir, "ws");
  mkdirSync(cfg);
  mkdirSync(ws);
  const port = await freePort();
  // not from the repository folder: the packaged folder must not need anything of it
  const child = spawn(join(dir, "runtime", runtimeName), [join(dir, "project", "node", "mobile-main.js"), cfg, ws, String(port)], { cwd: dir, stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try {
        up = (await fetch(`http://127.0.0.1:${port}/v1/hello`)).ok;
      } catch {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    assert.ok(up, "the packaged agent answers");
    assert.ok(existsSync(join(cfg, "pairing-code.txt")), "it wrote its pairing code for the app");
    assert.equal(readFileSync(join(cfg, "pairing-code.txt"), "utf8").trim().length, 16);
  } finally {
    await stop(child);
  }
});

test("a downloaded runtime is kept only when its SHA-256 is the pinned one", async () => {
  const bytes = Buffer.from("not really a runtime, but the bytes the server sends");
  const { url, server } = await serve(bytes);
  try {
    const good = join(work, "good");
    const ok = await run(["--out", good, "--no-build", "--runtime-url", url, "--runtime-sha256", createHash("sha256").update(bytes).digest("hex")]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(readFileSync(join(good, "runtime", runtimeName)), bytes);

    const bad = join(work, "bad");
    const refused = await run(["--out", bad, "--no-build", "--runtime-url", url, "--runtime-sha256", "0".repeat(64)]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /not the pinned one/);
    assert.equal(existsSync(join(bad, "runtime", runtimeName)), false, "a runtime that failed the check is not left behind");
    assert.equal(existsSync(join(bad, "runtime", `${runtimeName}.part`)), false, "nor its half-written file");
  } finally {
    server.close();
  }
});

test("a runtime is not fetched over plain http, except from this computer itself", async () => {
  const r = await run(["--out", join(work, "plain"), "--no-build", "--runtime-url", "http://example.com/node.exe", "--runtime-sha256", "0".repeat(64)]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /must come over https/);
});

test("without --node and without a pinned runtime for the platform it says what to do", async () => {
  const pinned = JSON.parse(readFileSync(join(root, "tools", "agent-runtime.json"), "utf8")) as { platforms: Record<string, { url: string; sha256: string }> };
  if (pinned.platforms[`${process.platform}-${process.arch}`]) return; // this platform has one
  const r = await run(["--out", join(work, "none"), "--no-build"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Pass --node PATH/);
});

test("the pinned runtime is an official nodejs.org address with a full SHA-256", () => {
  const pinned = JSON.parse(readFileSync(join(root, "tools", "agent-runtime.json"), "utf8")) as { version: string; platforms: Record<string, { url: string; sha256: string }> };
  for (const [platform, p] of Object.entries(pinned.platforms)) {
    assert.match(p.sha256, /^[0-9a-f]{64}$/, platform);
    assert.ok(p.url.startsWith(`https://nodejs.org/dist/v${pinned.version}/`), `${platform}: ${p.url}`);
  }
});
