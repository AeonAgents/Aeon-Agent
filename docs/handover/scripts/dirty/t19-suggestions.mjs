// The two new suggested prompts through the real EXAONE: do they finish inside the work folder with nothing prepared?
import { call, sleep } from "./drv.mjs";
const prompts = ["작업 폴더에 어떤 파일이 있는지 목록으로 알려 줘", "작업 폴더에 '오늘 할 일.txt' 파일을 만들고 할 일 세 가지를 적어 줘"];
async function until(id, maxMs = 400000) { const t0 = Date.now(); for (;;) { const t = (await call("GET", `/v1/tasks/${id}`)).body.task; if (["COMPLETED", "FAILED", "CANCELLED", "WAITING_FOR_APPROVAL"].includes(t.status) || Date.now() - t0 > maxMs) return t; await sleep(2500); } }
for (const goal of prompts) {
  const r = await call("POST", "/v1/tasks", { goal });
  const t = await until(r.body.task.id);
  console.log(`\n"${goal}"\n  status ${t.status} | steps ${(t.steps ?? []).map((s) => s.tool + (s.executed === false ? ":refused" : "")).join(" > ")} | verification ${t.verification?.status}`);
  console.log("  result:", String(t.result ?? t.error ?? t.note).replace(/\s+/g, " ").slice(0, 230));
}
