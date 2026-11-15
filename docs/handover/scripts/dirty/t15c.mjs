import { call } from "./drv.mjs";
const SRC = "<SCRATCH>/skill-src";
const ins = await call("POST", "/v1/skill-sources/inspect", { source: `${SRC}/risky-helper` });
const inst = await call("POST", "/v1/skill-sources/install", { previewId: ins.body.preview.id, name: "risky-helper", scope: "user" });
const sk = inst.body.skill ?? {};
console.log("install", inst.status, JSON.stringify({ safety: sk.safety, autoRun: sk.autoRun, autoRunEffective: sk.autoRunEffective, trusted: sk.trusted, status: sk.status, enabled: sk.enabled, active: sk.active, inactiveBecause: sk.inactiveBecause }));
const list = (await call("GET", "/v1/skills")).body.skills ?? [];
console.log("row:", JSON.stringify(list.find((s) => s.name === "risky-helper") ?? null).slice(0, 600));
console.log("cleanup", (await call("DELETE", "/v1/skills/risky-helper?scope=user")).status);
