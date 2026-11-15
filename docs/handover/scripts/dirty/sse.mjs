import { call, BASE } from "./drv.mjs";
// reads the audit events for a few seconds
import { generateKeyPairSync } from "node:crypto";
const ac = new AbortController();
setTimeout(() => ac.abort(), 2500);
try {
  const r = await call("GET", "/v1/events?after=0", undefined, { signal: ac.signal });
  console.log(r.status);
} catch (e) { /* aborted: the body is a stream, call() waits for text; fall through */ }
