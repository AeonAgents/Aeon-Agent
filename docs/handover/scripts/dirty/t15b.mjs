import { call } from "./drv.mjs";
const SRC = "<SCRATCH>/skill-src";
const r = await call("POST", "/v1/skill-sources/inspect", { source: `${SRC}/polite-greeter` });
console.log(r.status, JSON.stringify(r.body, null, 1).slice(0, 1800));
