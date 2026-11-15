import { call, sleep } from "./drv.mjs";
const r = await call("POST", "/v1/tasks", { goal: "작업 폴더의 keep-me.txt 파일을 삭제해줘" });
console.log("created", r.status, r.body.task?.id?.slice(-6));
for (let i = 0; i < 110; i++) {
  const a = ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((x) => x.tool === "fs.delete" && /keep-me/.test(x.summary));
  if (a.length) { console.log("pending:", a[0].id.slice(-6)); break; }
  await sleep(3000);
}
