import { call } from "./drv.mjs";
const c = (await call("GET", "/v1/config")).body.config;
console.log("before:", JSON.stringify({ providers: c.providers, dataConsent: c.dataConsent }));
const r = await call("PUT", "/v1/config", { ...c, dataConsent: ["exaone"] });
console.log("put:", r.status, JSON.stringify({ providers: r.body.config?.providers, dataConsent: r.body.config?.dataConsent }));
