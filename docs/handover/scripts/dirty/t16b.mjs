import { call, sleep } from "./drv.mjs";
for (let i = 0; i < 100; i++) {
  const a = ((await call("GET", "/v1/approvals?status=pending")).body.approvals ?? []).filter((x) => x.tool === "fs.delete");
  if (a.length) { console.log("pending delete approval:", JSON.stringify({ id: a[0].id.slice(-6), tool: a[0].tool, summary: a[0].summary, irreversible: a[0].irreversible, resources: a[0].resources })); break; }
  await sleep(3000);
}
