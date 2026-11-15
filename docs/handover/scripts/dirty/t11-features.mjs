// Every feature that asks the real EXAONE service, run end to end through the real server, one scenario at a time.
// Each scenario ends in an objective check (a file's text, a memory entry, a status), never in "it answered".
import { writeFileSync, existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const ws = new URL("./ws/", import.meta.url).pathname.replace(/^\//, "");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const DONE = ["COMPLETED", "FAILED", "CANCELLED"];
const rows = [];
const pendingFor = async (id) => ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((a) => a.taskId === id);

/** Runs a task to its end; approves what it asks for when `approve` is true. */
async function run(goal, { criteria, approve = false, maxMs = 300000 } = {}) {
  const r = await call("POST", "/v1/tasks", { goal, ...(criteria ? { criteria } : {}) });
  if (r.status !== 201 && r.status !== 200) return { error: `create ${r.status} ${JSON.stringify(r.body).slice(0, 120)}` };
  const id = r.body.task.id;
  const t0 = Date.now();
  let asked = 0;
  for (;;) {
    const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
    if (DONE.includes(t.status)) return { t, ms: Date.now() - t0, asked };
    if (t.status === "WAITING_FOR_APPROVAL" && approve) {
      for (const a of await pendingFor(id)) { await call("POST", `/v1/approvals/${a.id}/decide`, { decision: "approved" }); asked++; }
    }
    if (t.status === "WAITING_FOR_USER" || t.status === "NEEDS_INPUT") return { t, ms: Date.now() - t0, asked, waiting: true };
    if (Date.now() - t0 > maxMs) return { t, ms: Date.now() - t0, asked, timeout: true };
    await sleep(2000);
  }
}
async function scenario(name, fn) {
  if (only && !only.some((o) => name.startsWith(o))) return;
  const t0 = Date.now();
  let verdict, detail;
  try { [verdict, detail] = await fn(); } catch (e) { verdict = "ERROR"; detail = String(e?.message ?? e).slice(0, 200); }
  rows.push({ name, verdict, detail, s: Math.round((Date.now() - t0) / 1000) });
  console.log(`${verdict.padEnd(5)} ${name} (${Math.round((Date.now() - t0) / 1000)} s): ${detail}`);
}
const short = (s, n = 140) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
mkdirSync(ws, { recursive: true });

await scenario("A1 file task with a check", async () => {
  rmSync(ws + "hello.txt", { force: true });
  const r = await run("작업 폴더에 hello.txt 파일을 만들고 안에 '안녕하세요' 라고만 써줘", { criteria: [{ kind: "file_contains", path: "hello.txt", text: "안녕하세요", source: "user" }] });
  const ok = r.t?.status === "COMPLETED" && existsSync(ws + "hello.txt") && readFileSync(ws + "hello.txt", "utf8").includes("안녕하세요");
  return [ok ? "PASS" : "FAIL", `status ${r.t?.status}, ${r.ms} ms, verification ${r.t?.verification?.status}, attempt ${r.t?.attempt}, note ${short(r.t?.note, 60)}`];
});

await scenario("A2 read a file and write a summary", async () => {
  writeFileSync(ws + "notes.txt", "회의 메모\n- 다음 주 월요일 오전 10시에 출시 점검 회의를 한다.\n- 디자인 팀은 금요일까지 아이콘 12개를 마무리한다.\n- 서버 점검은 수요일 밤 11시, 약 30분 걸린다.\n- 예산은 지난달과 같고 추가 요청은 없다.\n");
  rmSync(ws + "summary.txt", { force: true });
  const r = await run("작업 폴더의 notes.txt를 읽고, 핵심만 세 줄로 요약해서 summary.txt에 저장해줘", { criteria: [{ kind: "file_exists", path: "summary.txt", source: "user" }], approve: true });
  const txt = existsSync(ws + "summary.txt") ? readFileSync(ws + "summary.txt", "utf8") : "";
  const ok = r.t?.status === "COMPLETED" && /월요일|금요일|수요일/.test(txt);
  return [ok ? "PASS" : "FAIL", `status ${r.t?.status}, ${r.ms} ms, lines ${txt.split("\n").filter(Boolean).length}, text "${short(txt, 100)}"`];
});

await scenario("B1 memory is used", async () => {
  const add = await call("POST", "/v1/memory", { text: "내가 제일 좋아하는 색은 청록색이야", kind: "preference" });
  const r = await run("내가 제일 좋아하는 색이 뭐였는지 한 문장으로 알려줘. 파일은 만들지 마.", { approve: true });
  const out = String(r.t?.result ?? "");
  if (add.body?.memory?.id) await call("DELETE", `/v1/memory/${add.body.memory.id}`);
  return [/청록/.test(out) ? "PASS" : "FAIL", `memory add ${add.status}, status ${r.t?.status}, ${r.ms} ms, answer "${short(out, 90)}"`];
});

await scenario("C1 a routine runs now", async () => {
  const c = await call("POST", "/v1/routines", { title: "작업 폴더에 routine.txt를 만들고 '루틴 완료'라고 써줘", schedule: { repeat: "daily", time: "03:30" } });
  const id = c.body.routine?.id;
  if (!id) return ["FAIL", `create ${c.status} ${short(JSON.stringify(c.body), 100)}`];
  rmSync(ws + "routine.txt", { force: true });
  const run1 = await call("POST", `/v1/routines/${id}/run`);
  const taskId = run1.body.task?.id ?? run1.body.taskId;
  let t;
  for (let i = 0; i < 150; i++) { t = taskId ? (await call("GET", `/v1/tasks/${taskId}`)).body.task : null; if (t && DONE.includes(t.status)) break; await sleep(2000); }
  await call("DELETE", `/v1/routines/${id}`);
  const ok = t?.status === "COMPLETED" && existsSync(ws + "routine.txt");
  return [ok ? "PASS" : "FAIL", `run ${run1.status}, task ${t?.status}, file ${existsSync(ws + "routine.txt")}`];
});

await scenario("D1 a skill changes the answer", async () => {
  const name = "meeting-notes-format";
  await call("DELETE", `/v1/skills/${name}?scope=user`);
  const put = await call("PUT", `/v1/skills/${name}`, { description: "회의 메모를 회의록 형식으로 정리할 때 쓴다", body: "# 회의록 정리\n\n회의 메모를 정리할 때는 반드시 아래 두 제목만 쓴다.\n\n■ 결정\n■ 할 일\n\n각 제목 아래에는 한 줄씩 짧게 쓴다.\n" });
  rmSync(ws + "minutes.txt", { force: true });
  const r = await run("작업 폴더의 notes.txt를 회의록 형식으로 정리해서 minutes.txt에 저장해줘", { approve: true });
  const txt = existsSync(ws + "minutes.txt") ? readFileSync(ws + "minutes.txt", "utf8") : "";
  await call("DELETE", `/v1/skills/${name}?scope=user`);
  return [/■ 결정/.test(txt) && /■ 할 일/.test(txt) ? "PASS" : "FAIL", `skill put ${put.status}, task ${r.t?.status}, approvals ${r.asked}, text "${short(txt, 100)}"`];
});

await scenario("E1 the agent asks when the goal is vague", async () => {
  const r = await run("그거 정리해줘", { maxMs: 120000 });
  const t = r.t;
  const asked = r.waiting || /WAITING|NEEDS/.test(String(t?.status)) || /\?|어떤|무엇|알려/.test(String(t?.result ?? t?.note ?? ""));
  return [asked ? "PASS" : "FAIL", `status ${t?.status}, note/result "${short(t?.note ?? t?.result, 100)}"`];
});

await scenario("F1 owner confirmation and re-check", async () => {
  const r = await run("작업 폴더에 check.txt 파일을 만들고 'ok'라고 써줘", { criteria: [{ kind: "file_contains", path: "check.txt", text: "ok", source: "user" }] });
  if (r.t?.status !== "COMPLETED") return ["FAIL", `status ${r.t?.status}`];
  const v = await call("POST", `/v1/tasks/${r.t.id}/verify`);
  const c = await call("POST", `/v1/tasks/${r.t.id}/confirm`);
  return [v.status < 300 && c.status < 300 ? "PASS" : "FAIL", `verify ${v.status}, confirm ${c.status}`];
});

await scenario("G1 usage is counted", async () => {
  const u = await call("GET", "/v1/usage");
  return [u.status === 200 ? "PASS" : "FAIL", short(JSON.stringify(u.body), 180)];
});

console.log("\nSummary:", rows.map((r) => `${r.name.split(" ")[0]}=${r.verdict}`).join("  "));
