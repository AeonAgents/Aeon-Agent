import { call, sleep } from "./drv.mjs";
const goal = "작업 폴더에 a1.txt, a2.txt, a3.txt, a4.txt, a5.txt 다섯 파일을 각각 만들고, 각 파일 안에 그 파일 이름만 써줘. 다 만든 뒤 폴더 목록을 보고 다섯 개가 있는지 확인해줘.";
const criteria = [1, 2, 3, 4, 5].map((n) => ({ kind: "file_contains", path: `a${n}.txt`, text: `a${n}`, source: "user" }));
const t0 = Date.now();
const id = (await call("POST", "/v1/tasks", { goal, criteria })).body.task.id;
let last = "";
for (;;) {
  const t = (await call("GET", `/v1/tasks/${id}`)).body.task;
  const line = `${t.status} steps=${t.stepCount ?? t.steps?.length ?? "?"} ${t.note ?? ""}`.slice(0, 100);
  if (line !== last) { console.log(`+${Math.round((Date.now() - t0) / 1000)}s ${line}`); last = line; }
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(t.status) || Date.now() - t0 > 600000) {
    console.log(JSON.stringify({ status: t.status, verification: t.verification?.status, error: t.error, result: String(t.result).slice(0, 220) }));
    break;
  }
  await sleep(2500);
}
