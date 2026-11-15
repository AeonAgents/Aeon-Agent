// Dirty input tests against the real server (no model call needed for most): what does the person get back?
import { call, BASE } from "./drv.mjs";

const show = (label, r) => console.log(`${label.padEnd(44)} -> ${r.status} ${JSON.stringify(r.body).slice(0, 170)}`);

show("status", await call("GET", "/v1/status"));

const post = (b) => call("POST", "/v1/tasks", b);
show("goal empty", await post({ goal: "" }));
show("goal spaces only", await post({ goal: "    \n\t " }));
show("goal missing", await post({}));
show("goal number", await post({ goal: 42 }));
show("goal array", await post({ goal: ["a"] }));
show("goal 4001 chars", await post({ goal: "가".repeat(4001) }));
show("body is not JSON", await post("{not json"));
show("body is JSON null", await post("null"));
show("body is a JSON array", await post("[1,2]"));
show("criteria is a string", await post({ goal: "x", criteria: "file_exists" }));
show("criteria entry without kind", await post({ goal: "x", criteria: [{}] }));
show("runAfter is a string", await post({ goal: "x", runAfter: "tomorrow" }));
show("runAfter is NaN-like (1e999)", await post('{"goal":"x","runAfter":1e999}'));
show("unknown task id", await call("GET", "/v1/tasks/task_doesnotexist"));
show("task id with traversal", await call("GET", "/v1/tasks/..%2f..%2fetc"));
show("cancel unknown task", await call("POST", "/v1/tasks/task_nope/cancel"));
show("approvals bad status filter", await call("GET", "/v1/approvals?status=%00"));
show("decide unknown approval", await call("POST", "/v1/approvals/appr_nope/decide", { decision: "approved" }));
show("method not allowed on /v1/tasks", await call("DELETE", "/v1/tasks"));
show("unknown route", await call("GET", "/v1/nothing"));
show("replayed nonce", await (async () => {
  const nonce = "fixednonce123456";
  await call("GET", "/v1/status", undefined, { nonce });
  return call("GET", "/v1/status", undefined, { nonce });
})());
show("timestamp 5 minutes old", await call("GET", "/v1/status", undefined, { ts: Date.now() - 5 * 60_000 }));
const big = await fetch(`${BASE}/v1/pair`, { method: "POST", body: "x".repeat(2_000_000) }).then((r) => r.status).catch((e) => "reset: " + e.cause?.code);
console.log("2 MB body to the open pairing route".padEnd(44), "->", big);
