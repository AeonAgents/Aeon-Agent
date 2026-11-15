// A skill the agent makes with the owner's approval, then uses in a later task. The owner cannot create one by hand (by design).
import { writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const ws = new URL("./ws/", import.meta.url).pathname.replace(/^\//, "");
const DONE = ["COMPLETED", "FAILED", "CANCELLED"];
const pendingFor = async (id) => ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((a) => a.taskId === id);
async function run(goal, maxMs = 700000) {
  const r = await call("POST", "/v1/tasks", { goal });
  const id = r.body.task.id; const t0 = Date.now(); const asked = [];
  for (;;) {
    const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
    if (DONE.includes(t.status)) return { t, ms: Date.now() - t0, asked };
    if (t.status === "WAITING_FOR_APPROVAL") for (const a of await pendingFor(id)) { asked.push(`${a.tool}:${String(a.summary).slice(0, 60)}`); await call("POST", `/v1/approvals/${a.id}/decide`, { decision: "approved" }); }
    if (Date.now() - t0 > maxMs) return { t, ms: Date.now() - t0, asked, timeout: true };
    await sleep(2000);
  }
}
const short = (s, n = 160) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
writeFileSync(ws + "notes.txt", "회의 메모\n- 다음 주 월요일 오전 10시에 출시 점검 회의를 한다.\n- 디자인 팀은 금요일까지 아이콘 12개를 마무리한다.\n- 서버 점검은 수요일 밤 11시, 약 30분 걸린다.\n");
rmSync(ws + "minutes.txt", { force: true });
const before = (await call("GET", "/v1/skills")).body.skills?.map((s) => s.name) ?? [];
const make = await run("앞으로 회의 메모를 정리할 때 쓸 '회의록 정리' 스킬을 만들어줘. 규칙: 결과에는 반드시 '■ 결정'과 '■ 할 일' 두 제목만 쓰고 각 제목 아래에 한 줄씩 쓴다.");
const after = (await call("GET", "/v1/skills")).body.skills?.map((s) => s.name) ?? [];
const added = after.filter((n) => !before.includes(n));
console.log(`make: status ${make.t.status}, ${Math.round(make.ms / 1000)} s, approvals [${make.asked.join(" | ")}], new skills [${added.join(", ")}]`);
if (added.length) {
  const use = await run("작업 폴더의 notes.txt를 회의록 정리 스킬대로 정리해서 minutes.txt에 저장해줘");
  const txt = existsSync(ws + "minutes.txt") ? readFileSync(ws + "minutes.txt", "utf8") : "";
  console.log(`use: status ${use.t.status}, ${Math.round(use.ms / 1000)} s, approvals [${use.asked.join(" | ")}], has both headings: ${/■ 결정/.test(txt) && /■ 할 일/.test(txt)}, text "${short(txt)}"`);
  for (const n of added) console.log(`cleanup ${n}:`, (await call("DELETE", `/v1/skills/${n}?scope=user`)).status);
}
console.log("done");
