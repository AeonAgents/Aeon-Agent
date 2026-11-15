import { call, waitTask } from "./drv.mjs";
const tasks = (await call("GET", "/v1/tasks")).body.tasks;
for (const t of tasks) if (!["COMPLETED", "FAILED", "CANCELLED"].includes(t.status)) console.log("cancel old", t.id.slice(-6), (await call("POST", `/v1/tasks/${t.id}/cancel`)).status);
const r = await call("POST", "/v1/tasks", { goal: "작업 폴더에 hello.txt 파일을 만들고 안에 '안녕하세요' 라고만 써줘", criteria: [{ kind: "file_contains", path: "hello.txt", text: "안녕하세요", source: "user" }] });
console.log("create", r.status, r.body.task?.id);
const t0 = Date.now();
const done = await waitTask(r.body.task.id, { maxMs: 200000 });
console.log(`after ${Date.now() - t0} ms:`, JSON.stringify({ status: done.status, note: done.note, error: done.error, result: done.result?.slice?.(0, 200), verification: done.verification?.status, attempt: done.attempt }));
