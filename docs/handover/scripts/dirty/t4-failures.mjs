// One task per failure the real service can show. The proxy turns the real EXAONE connection into each failure on purpose.
import { writeFileSync } from "node:fs";
import { call, sleep } from "./drv.mjs";
const modes = process.argv.slice(2);
const setMode = (m) => writeFileSync(new URL("./chaos.mode", import.meta.url), m);
async function cancelAll() {
  for (const t of (await call("GET", "/v1/tasks")).body.tasks) if (!["COMPLETED", "FAILED", "CANCELLED"].includes(t.status)) await call("POST", `/v1/tasks/${t.id}/cancel`);
}
for (const m of modes) {
  await cancelAll();
  for (let i = 0; i < 120; i++) { const b = (await call("GET", "/v1/status")).body.providers?.[0]?.blockedUntil; if (!b) break; await sleep(2000); }
  setMode(m);
  const r = await call("POST", "/v1/tasks", { goal: `실패 시험 ${m}: ok.txt 파일을 만들고 ok 라고 써줘` });
  const id = r.body.task.id;
  const t0 = Date.now();
  const seen = [];
  let last = "";
  while (Date.now() - t0 < (m === "hang" ? 200_000 : 60_000)) {
    const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
    const line = `${t.status}|${t.note ?? ""}|${(t.error ?? "").slice(0, 150)}`;
    if (line !== last) { seen.push(`+${Math.round((Date.now() - t0) / 1000)}s ${line}`); last = line; }
    if (["FAILED", "COMPLETED", "CANCELLED"].includes(t.status)) break;
    await sleep(1500);
  }
  console.log(`== ${m}\n   ` + seen.join("\n   "));
}
setMode("pass");
await cancelAll();
