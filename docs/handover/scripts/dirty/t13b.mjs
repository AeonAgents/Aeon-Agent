import { call } from "./drv.mjs";
const c = await call("GET", "/v1/config");
const profile = { ...(c.body.config?.profile ?? {}), interests: ["인공지능", "IT"] };
console.log("config put:", (await call("PUT", "/v1/config", { profile })).status);
