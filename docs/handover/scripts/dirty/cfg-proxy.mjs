import { call } from "./drv.mjs";
const which = process.argv[2] ?? "proxy";
const cfg = which === "proxy"
  ? { providers: ["exaone-proxy"], dataConsent: [], fallbackAllowed: false, endpoints: [{ id: "exaone-proxy", name: "EXAONE (proxy)", baseUrl: "http://127.0.0.1:7470/v1", model: "k-exaone_v2.5", keyName: "AEON_EP_EXAONE_PROXY_KEY", reasoningEffort: "low" }] }
  : { providers: ["exaone"], dataConsent: ["exaone"], fallbackAllowed: false };
if (which === "proxy") console.log("secret", JSON.stringify((await call("PUT", "/v1/secrets/AEON_EP_EXAONE_PROXY_KEY", { value: "unused-the-proxy-adds-the-real-key" })).body));
console.log("config", JSON.stringify(await call("PUT", "/v1/config", cfg)));
console.log(JSON.stringify((await call("GET", "/v1/status")).body.providers ?? (await call("GET", "/v1/status")).body, null, 0).slice(0, 600));
