import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const ws = new URL("./ws/", import.meta.url).pathname.replace(/^\//, "");
async function until(id, pred, maxMs = 150000) { const t0 = Date.now(); for (;;) { const t = (await call("GET", `/v1/tasks/${id}`)).body.task; if (pred(t) || Date.now() - t0 > maxMs) return t; await sleep(1500); } }
const pendingFor = async (id) => ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((a) => a.taskId === id);

// 1) approve
writeFileSync(ws + "old.txt", "x");
let r = await call("POST", "/v1/tasks", { goal: "작업 폴더의 old.txt 파일을 삭제해줘" });
let id = r.body.task.id;
let t = await until(id, (t) => t.status === "WAITING_FOR_APPROVAL" || ["FAILED", "COMPLETED"].includes(t.status));
console.log("1) status:", t.status, "| file still there:", existsSync(ws + "old.txt"));
const ap = await pendingFor(id);
console.log("   approvals:", ap.map((a) => ({ tool: a.tool, summary: a.summary, irreversible: a.irreversible, resources: a.resources })));
if (ap[0]) {
  const a = ap[0].id;
  console.log("   decide 'maybe':", (await call("POST", `/v1/approvals/${a}/decide`, { decision: "maybe" })).status);
  console.log("   decide no body:", (await call("POST", `/v1/approvals/${a}/decide`)).status);
  const [d1, d2] = await Promise.all([call("POST", `/v1/approvals/${a}/decide`, { decision: "approved" }), call("POST", `/v1/approvals/${a}/decide`, { decision: "approved" })]);
  console.log("   two approvals at the same moment ->", d1.status, d2.status, JSON.stringify(d2.body).slice(0, 80));
  t = await until(id, (t) => ["COMPLETED", "FAILED", "CANCELLED"].includes(t.status));
  console.log("   after approval:", t.status, "| file gone:", !existsSync(ws + "old.txt"), "| verification:", t.verification?.status, "|", String(t.result).slice(0, 100));
  console.log("   decide again after completion:", (await call("POST", `/v1/approvals/${a}/decide`, { decision: "denied" })).status);
}

// 2) deny
writeFileSync(ws + "keep.txt", "keep me");
r = await call("POST", "/v1/tasks", { goal: "작업 폴더의 keep.txt 파일을 삭제해줘" });
id = r.body.task.id;
t = await until(id, (t) => t.status === "WAITING_FOR_APPROVAL" || ["FAILED", "COMPLETED"].includes(t.status));
const ap2 = await pendingFor(id);
if (ap2[0]) {
  console.log("2) deny:", (await call("POST", `/v1/approvals/${ap2[0].id}/decide`, { decision: "denied" })).status);
  t = await until(id, (t) => ["COMPLETED", "FAILED", "CANCELLED"].includes(t.status));
  console.log("   after denial:", t.status, "| file kept:", existsSync(ws + "keep.txt"), "|", String(t.result ?? t.error).slice(0, 160));
} else console.log("2) no approval appeared; status", t.status);
