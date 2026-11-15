// Each failure mode on a freshly restarted server, so one mode's cool-down cannot colour the next.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const here = new URL(".", import.meta.url).pathname.replace(/^\//, "");
const setMode = (m) => writeFileSync(here + "chaos.mode", m);
for (const m of process.argv.slice(2)) {
  setMode("pass");
  execFileSync("powershell", ["-NoProfile", "-File", here + "restart-server.ps1"], { stdio: "ignore" });
  for (const t of (await call("GET", "/v1/tasks")).body.tasks ?? []) if (!["COMPLETED", "FAILED", "CANCELLED"].includes(t.status)) await call("POST", `/v1/tasks/${t.id}/cancel`);
  setMode(m);
  const id = (await call("POST", "/v1/tasks", { goal: `실패 시험 ${m}: ok.txt 파일을 만들고 ok 라고 써줘` })).body.task.id;
  const t0 = Date.now(); const seen = []; let last = "";
  const limit = m === "hang" ? 400_000 : 90_000;
  while (Date.now() - t0 < limit) {
    const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
    const line = `${t.status}|${t.note ?? ""}|${(t.error ?? "").slice(0, 140)}`;
    if (line !== last) { seen.push(`+${Math.round((Date.now() - t0) / 1000)}s ${line}`); last = line; }
    if (["FAILED", "COMPLETED", "CANCELLED"].includes(t.status)) break;
    await sleep(1500);
  }
  console.log(`== ${m}\n   ` + seen.join("\n   "));
}
setMode("pass");
