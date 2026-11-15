import { pathToFileURL } from "node:url";
const base = "C:/Users/<you>/project/Aeon/src/node/";
const { bootRuntime } = await import(pathToFileURL(base + "bootstrap.ts").href);
const cfg = "<SCRATCH>/dirty/cfg";
const { runtime, problem } = await bootRuntime(cfg, "<SCRATCH>/dirty/ws", {}, undefined, true);
console.log("problem:", problem, "| candidates:", runtime.router.candidates().length, "| cfg keys:", Object.keys(runtime.router.cfg ?? {}).join(","));
