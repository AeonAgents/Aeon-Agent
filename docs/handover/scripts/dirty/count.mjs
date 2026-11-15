import { call } from "./drv.mjs";
const t = (await call("GET", "/v1/tasks")).body.tasks ?? [];
console.log(t.length, "tasks;", t.slice(0, 3).map((x) => `${x.status}:${x.goal.slice(0, 24)}`).join(" | "));
