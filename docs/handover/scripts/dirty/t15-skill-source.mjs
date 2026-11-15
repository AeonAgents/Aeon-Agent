// Installing a skill from a folder on the machine: a clean one and one with a dangerous script. Nothing is downloaded.
import { call } from "./drv.mjs";
const SRC = "<SCRATCH>/skill-src";
const short = (v, n = 220) => String(typeof v === "string" ? v : JSON.stringify(v)).replace(/\s+/g, " ").slice(0, n);
const names = async () => ((await call("GET", "/v1/skills")).body.skills ?? []).map((s) => `${s.name}[${s.scope}${s.enabled === false ? ",off" : ""}]`);
console.log("before:", (await names()).join(", ") || "(none)");

for (const name of ["polite-greeter", "risky-helper"]) {
  const ins = await call("POST", "/v1/skill-sources/inspect", { source: `${SRC}/${name}` });
  const b = ins.body.preview ?? {}; const previewId = b.id;
  console.log(`\n${name}: inspect ${ins.status}`);
  if (ins.status !== 200) { console.log("  ", short(b)); continue; }
  const item = (b.candidates ?? [])[0] ?? {};
  console.log("  previewId:", Boolean(previewId), "| skills found:", (b.candidates ?? []).length, "| scripts:", item.scripts, "| name:", item.name, "| files:", short((item.files ?? []).map((f) => f.path), 80));
  console.log("  safety/problems:", short({ safety: item.safety, problems: item.problems, warnings: item.warnings }, 520));
  const inst = await call("POST", "/v1/skill-sources/install", { previewId, name: item.name ?? name, scope: "user" });
  console.log("  install", inst.status, short(inst.body, 260));
}
console.log("\nafter:", (await names()).join(", ") || "(none)");

// a second install of the same name, and a path that is not a skill
const again = await call("POST", "/v1/skill-sources/inspect", { source: `${SRC}/polite-greeter` });
const dup = await call("POST", "/v1/skill-sources/install", { previewId: again.body.preview.id, name: "polite-greeter", scope: "user" });
console.log("\nsame name again:", dup.status, short(dup.body, 160));
const nothing = await call("POST", "/v1/skill-sources/inspect", { source: `${SRC}/does-not-exist` });
console.log("folder that does not exist:", nothing.status, short(nothing.body, 160));
const parent = await call("POST", "/v1/skill-sources/inspect", { source: SRC });
console.log("a folder holding both:", parent.status, "skills found", (parent.body.preview?.candidates ?? []).length, "names", (parent.body.preview?.candidates ?? []).map((c) => c.name).join("+"), short(parent.body.error ?? "", 120));

// cleanup
for (const n of ["polite-greeter", "risky-helper"]) console.log("cleanup", n, (await call("DELETE", `/v1/skills/${n}?scope=user`)).status);
console.log("end:", (await names()).join(", ") || "(none)");
