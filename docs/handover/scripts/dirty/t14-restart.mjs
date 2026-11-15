// The server is killed in the middle of a real task and started again: does the task continue and finish, with the real EXAONE?
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const ws = new URL("./ws/", import.meta.url).pathname.replace(/^\//, "");
const here = new URL("./", import.meta.url).pathname.replace(/^\//, "");
for (const f of ["r1.txt", "r2.txt", "r3.txt"]) rmSync(ws + f, { force: true });
const r = await call("POST", "/v1/tasks", { goal: "작업 폴더에 r1.txt, r2.txt, r3.txt 세 파일을 만들고 각각 안에 1, 2, 3 이라고만 써줘", criteria: [1, 2, 3].map((n) => ({ kind: "file_contains", path: `r${n}.txt`, text: String(n), source: "user" })) });
const id = r.body.task.id;
console.log("created", r.status, id.slice(-6));
let t;
for (let i = 0; i < 60; i++) { t = (await call("GET", `/v1/tasks/${id}`)).body.task; if (!["PENDING", "QUEUED", "CREATED"].includes(t.status)) break; await sleep(1000); }
await sleep(4000);
t = (await call("GET", `/v1/tasks/${id}`)).body.task;
console.log("before kill:", t.status, "files so far:", [1, 2, 3].map((n) => existsSync(`${ws}r${n}.txt`)).join(","));
console.log(execFileSync("powershell", ["-NoProfile", "-File", here + "restart-server.ps1"], { encoding: "utf8" }).trim());
await sleep(3000);
const t0 = Date.now();
for (;;) {
  t = (await call("GET", `/v1/tasks/${id}`)).body.task;
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(t.status) || Date.now() - t0 > 420000) break;
  await sleep(3000);
}
const files = [1, 2, 3].map((n) => existsSync(`${ws}r${n}.txt`) ? readFileSync(`${ws}r${n}.txt`, "utf8").trim() : "-");
console.log(`after restart: ${t.status} in ${Math.round((Date.now() - t0) / 1000)} s, verification ${t.verification?.status}, attempt ${t.attempt}, files [${files.join(",")}], note "${String(t.note ?? "").slice(0, 80)}"`);
const ev = (await call("GET", "/v1/tasks")).body.tasks.filter((x) => x.id === id);
console.log("listed once:", ev.length === 1);
