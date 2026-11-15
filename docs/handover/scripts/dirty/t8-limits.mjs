import { writeFileSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const here = new URL(".", import.meta.url).pathname.replace(/^\//, "");
const setMode = (m) => writeFileSync(here + "chaos.mode", m);
const which = process.argv[2];
const watch = async (id, ms, stop) => {
  const t0 = Date.now(); const seen = []; let last = "";
  while (Date.now() - t0 < ms) {
    const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
    const line = `${t.status}|${(t.note ?? "").slice(0, 60)}|${(t.error ?? "").slice(0, 100)}`;
    if (line !== last) { seen.push(`+${Math.round((Date.now() - t0) / 1000)}s ${line}`); last = line; }
    if (stop(t)) break;
    await sleep(1500);
  }
  return seen;
};
if (which === "dayquota") {
  setMode("dayquota");
  const id = (await call("POST", "/v1/tasks", { goal: "하루 한도 시험: q.txt 를 만들고 q 라고 써줘" })).body.task.id;
  console.log((await watch(id, 40000, (t) => t.status === "WAITING_FOR_QUOTA")).join("\n"));
  const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
  console.log("runAfter in minutes:", Math.round((t.runAfter - Date.now()) / 60000));
}
if (which === "named429") {
  setMode("429");
  const id = (await call("POST", "/v1/tasks", { goal: "대기 시간 429 시험: n.txt 를 만들고 n 이라고 써줘" })).body.task.id;
  console.log((await watch(id, 25000, () => false)).join("\n"));
  setMode("pass");
  console.log("-- the service recovers");
  console.log((await watch(id, 150000, (t) => ["COMPLETED", "FAILED"].includes(t.status))).join("\n"));
}
if (which === "hang") {
  setMode("hang");
  const id = (await call("POST", "/v1/tasks", { goal: "멈춤 시험: h.txt 를 만들고 h 라고 써줘" })).body.task.id;
  console.log((await watch(id, 150000, (t) => t.status === "RETRY_WAIT")).join("\n"));
  setMode("pass");
  console.log("-- the service recovers");
  console.log((await watch(id, 200000, (t) => ["COMPLETED", "FAILED"].includes(t.status))).join("\n"));
}
setMode("pass");
