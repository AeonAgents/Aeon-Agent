// Real EXAONE: a task whose only action the owner denies. What status and note does the saved task carry?
import { writeFileSync, existsSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const ws = new URL("./ws/", import.meta.url).pathname.replace(/^\//, "");
async function until(id, pred, maxMs = 420000) { const t0 = Date.now(); for (;;) { const t = (await call("GET", `/v1/tasks/${id}`)).body.task; if (pred(t) || Date.now() - t0 > maxMs) return t; await sleep(2000); } }
writeFileSync(ws + "keep18c.txt", "keep me");
const r = await call("POST", "/v1/tasks", { goal: "작업 폴더의 keep18c.txt 파일을 지금 바로 삭제해줘. 되묻지 말고 삭제 도구를 바로 써줘." });
const id = r.body.task.id;
let t = await until(id, (t) => t.status === "WAITING_FOR_APPROVAL" || ["FAILED", "COMPLETED"].includes(t.status));
console.log("1) status:", t.status);
const ap = ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((a) => a.taskId === id);
if (!ap[0]) { console.log("no approval; result", String(t.result ?? t.error).slice(0, 200)); process.exit(0); }
console.log("   approval is for:", ap[0].tool, "|", String(ap[0].summary).slice(0,80)); console.log("2) deny:", (await call("POST", `/v1/approvals/${ap[0].id}/decide`, { decision: "denied" })).status);
t = await until(id, (t) => ["COMPLETED", "FAILED", "CANCELLED"].includes(t.status));
console.log("3) after denial:", t.status, "| note:", JSON.stringify(t.note), "| file kept:", existsSync(ws + "keep18c.txt"));
console.log("   result:", String(t.result ?? t.error).replace(/\s+/g, " ").slice(0, 200));
const list = (await call("GET", "/v1/tasks")).body.tasks ?? [];
const row = list.find((x) => x.id === id);
console.log("4) in the list: status", row?.status, "| note", JSON.stringify(row?.note));
