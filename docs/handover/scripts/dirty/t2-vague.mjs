import { call, waitTask } from "./drv.mjs";
const list = (await call("GET", "/v1/tasks")).body.tasks ?? [];
console.log("tasks:", list.map((t) => `${t.id.slice(-6)}:${t.status}:${t.goal.slice(0, 20)}`).join(" | "));
for (const t of list) {
  const done = await waitTask(t.id, { maxMs: 120000 });
  console.log(JSON.stringify({ goal: done.goal, status: done.status, note: done.note, result: done.result?.slice?.(0, 300) ?? done.result, error: done.error }));
}
