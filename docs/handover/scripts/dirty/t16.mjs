import { call } from "./drv.mjs";
const r = await call("POST", "/v1/tasks", { goal: "작업 폴더의 to-delete.txt 파일을 삭제해줘" });
console.log("created", r.status, r.body.task?.id?.slice(-6));
