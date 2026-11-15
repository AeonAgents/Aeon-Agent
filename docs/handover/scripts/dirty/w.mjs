import { call, waitTask } from "./drv.mjs";
const id = process.argv[2] || (await call("GET", "/v1/tasks")).body.tasks[0].id;
const t0 = Date.now();
let last = "";
for (;;) {
  const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
  const line = `${t.status} ${t.note ?? ""} ${t.error ? "ERR:" + t.error.slice(0, 160) : ""}`;
  if (line !== last) { console.log(`[+${Math.round((Date.now() - t0) / 1000)}s] ${line}`); last = line; }
  if (["COMPLETED", "FAILED", "CANCELLED", "WAITING_FOR_APPROVAL"].includes(t.status) || Date.now() - t0 > (Number(process.argv[3]) || 150) * 1000) { console.log(JSON.stringify({ result: t.result?.slice?.(0, 300), verification: t.verification?.status })); break; }
  await new Promise((r) => setTimeout(r, 2000));
}
